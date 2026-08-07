import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { generateMovieStoryboard, generateScene } from "@/lib/ai/gemini";
import { storeGeneratedScene } from "@/lib/analysis/generated-scene";
import {
  inspectImage,
  prepareBirthdaySceneForUpload,
  prepareImageForGemini,
} from "@/lib/analysis/image";
import { reportServerError } from "@/lib/observability";
import {
  buildMovieScenePrompt,
  buildMovieDirection,
  movieSceneSchema,
  movieTitleSchema,
} from "@/lib/movie/scenes";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { petDialogueSchema } from "@/lib/video/dialogue";
import type { Json } from "@/lib/supabase/database.types";

export const maxDuration = 60;

const createSchema = z.object({
  analysisId: z.string().uuid(),
  movie: movieTitleSchema,
  scene: movieSceneSchema,
});
const saveSchema = createSchema.extend({
  dialogue: petDialogueSchema,
  voiceInstruction: z.string().trim().max(160),
});

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return Response.json({ error: "Movie scenes are temporarily unavailable." }, { status: 503 });
  }
  const limit = await checkRateLimit({
    request,
    scope: "movie-scene-create",
    userId: user.id,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
  const body = saveSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Choose a movie scene." }, { status: 400 });

  const admin = createAdminClient();
  const { data: analysis } = await admin
    .from("analysis_requests")
    .select("id, object_path, card_photo_path, draft_data")
    .eq("id", body.data.analysisId)
    .eq("user_id", user.id)
    .eq("experience_kind", "movie_scene")
    .in("status", ["awaiting_name", "awaiting_payment"])
    .maybeSingle();
  if (!analysis?.object_path) {
    return Response.json({ error: "That movie draft is unavailable." }, { status: 404 });
  }

  const requestId = crypto.randomUUID();
  const outputPath = `${user.id}/${analysis.id}/movie-${requestId}.jpg`;
  try {
    const { data: source } = await admin.storage.from("analysis-photos").download(analysis.object_path);
    if (!source) throw new Error("movie_source_missing");
    const sourceBuffer = Buffer.from(await source.arrayBuffer());
    await inspectImage(sourceBuffer);
    const generated = await generateScene({
      images: [await prepareImageForGemini(sourceBuffer)],
      prompt: buildMovieScenePrompt(body.data.movie, body.data.scene),
    });
    const jpeg = await prepareBirthdaySceneForUpload(generated);
    const movieStoryboard = await generateMovieStoryboard({
      image: jpeg,
      movie: body.data.movie,
      scene: body.data.scene,
      dialogue: body.data.dialogue,
      voiceInstruction: body.data.voiceInstruction,
    });
    const movieDirection = buildMovieDirection(movieStoryboard);
    await storeGeneratedScene(outputPath, jpeg);
    const previous = analysis.draft_data && typeof analysis.draft_data === "object" && !Array.isArray(analysis.draft_data)
      ? analysis.draft_data as Record<string, Json | undefined>
      : {};
    const { error: updateError } = await admin
      .from("analysis_requests")
      .update({
        card_photo_path: outputPath,
        selected_dialogue: body.data.dialogue,
        draft_data: {
          ...previous,
          movie: body.data.movie,
          scene: body.data.scene,
          sceneReady: true,
          movieStoryboard,
          movieDirection,
          voiceInstruction: body.data.voiceInstruction,
        },
        status: "awaiting_name",
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysis.id)
      .eq("user_id", user.id);
    if (updateError) {
      await admin.storage.from("analysis-photos").remove([outputPath]);
      throw new Error(`movie_draft_update_failed:${updateError.message}`);
    }
    if (analysis.card_photo_path && analysis.card_photo_path !== outputPath) {
      await admin.storage.from("analysis-photos").remove([analysis.card_photo_path]);
    }
    return Response.json({ id: analysis.id, previewUrl: `/api/analyses/${analysis.id}/photo?v=${requestId}` });
  } catch (error) {
    reportServerError(error, { operation: "movie_scene_create", analysisId: analysis.id });
    return Response.json({ error: "The movie scene could not be created. Try again." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = saveSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Movie draft details are invalid." }, { status: 400 });
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("analysis_requests")
    .select("draft_data, selected_dialogue")
    .eq("id", body.data.analysisId)
    .eq("user_id", user.id)
    .eq("experience_kind", "movie_scene")
    .in("status", ["awaiting_name", "awaiting_payment"])
    .maybeSingle();
  if (!current) return Response.json({ error: "Movie draft could not be saved." }, { status: 409 });
  const previous = current.draft_data && typeof current.draft_data === "object" && !Array.isArray(current.draft_data)
    ? current.draft_data as Record<string, Json | undefined>
    : {};
  const sceneStillMatches =
    previous.sceneReady === true &&
    previous.movie === body.data.movie &&
    previous.scene === body.data.scene &&
    current.selected_dialogue === body.data.dialogue &&
    (previous.voiceInstruction ?? "") === body.data.voiceInstruction;
  const { data, error } = await admin
    .from("analysis_requests")
    .update({
      selected_dialogue: body.data.dialogue,
      draft_data: {
        ...previous,
        movie: body.data.movie,
        scene: body.data.scene,
        sceneReady: sceneStillMatches,
        movieStoryboard: sceneStillMatches ? previous.movieStoryboard : null,
        movieDirection: sceneStillMatches ? previous.movieDirection : null,
        voiceInstruction: body.data.voiceInstruction,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.data.analysisId)
    .eq("user_id", user.id)
    .eq("experience_kind", "movie_scene")
    .in("status", ["awaiting_name", "awaiting_payment"])
    .select("id")
    .maybeSingle();
  if (error || !data) return Response.json({ error: "Movie draft could not be saved." }, { status: 409 });
  return Response.json({ saved: true });
}
