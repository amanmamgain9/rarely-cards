import { z } from "zod";
import { interpretMovieText, interpretMovieVoice } from "@/lib/ai/gemini";
import { requireUser } from "@/lib/auth";
import { reportServerError } from "@/lib/observability";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const requestSchema = z.object({
  analysisId: z.string().uuid(),
  mode: z.enum(["scene", "dialogue"]),
});
const allowedMimeTypes = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"]);

function extensionForMime(mimeType: string) {
  return mimeType === "audio/ogg" ? "ogg" : mimeType === "audio/mp4" ? "m4a" : mimeType === "audio/mpeg" ? "mp3" : "webm";
}

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return Response.json({ error: "Movie customization is temporarily unavailable." }, { status: 503 });
  }
  const limit = await checkRateLimit({
    request,
    scope: "movie-voice-transcribe",
    userId: user.id,
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const form = await request.formData().catch(() => null);
  const parsed = requestSchema.safeParse({
    analysisId: form?.get("analysisId"),
    mode: form?.get("mode"),
  });
  const audio = form?.get("audio");
  const instruction = typeof form?.get("instruction") === "string"
    ? String(form.get("instruction")).trim()
    : "";
  const validAudio = audio instanceof File && audio.size > 0;
  if (
    !parsed.success ||
    (!validAudio && (!instruction || instruction.length > 600)) ||
    (validAudio && (audio.size > 5 * 1024 * 1024 || !allowedMimeTypes.has(audio.type)))
  ) {
    return Response.json({ error: "Record up to 5 MB of audio, or type up to 600 characters." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: draft } = await admin
    .from("analysis_requests")
    .select("id, draft_data")
    .eq("id", parsed.data.analysisId)
    .eq("user_id", user.id)
    .eq("experience_kind", "movie_scene")
    .in("status", ["awaiting_name", "awaiting_payment"])
    .maybeSingle();
  if (!draft) return Response.json({ error: "Movie draft not found." }, { status: 404 });

  const previous = draft.draft_data && typeof draft.draft_data === "object" && !Array.isArray(draft.draft_data)
    ? draft.draft_data as Record<string, Json | undefined>
    : {};
  const previousPath = typeof previous.voiceRecordingPath === "string"
    ? previous.voiceRecordingPath
    : null;
  const requestId = crypto.randomUUID();
  try {
    const result = validAudio
      ? await interpretMovieVoice({
        audio: Buffer.from(await audio.arrayBuffer()),
        mimeType: audio.type,
        mode: parsed.data.mode,
      })
      : await interpretMovieText({ instruction, currentMovie: String(previous.movie ?? "") });
    const storage = admin.storage.from("movie-voice-recordings");
    const path = validAudio
      ? `${user.id}/${draft.id}/${requestId}.${extensionForMime(audio.type)}`
      : previousPath;
    if (validAudio && path) {
      const { error: uploadError } = await storage.upload(path, audio, {
        contentType: audio.type,
        upsert: false,
      });
      if (uploadError) throw new Error(`movie_voice_upload_failed:${uploadError.message}`);
    }
    const draftData = {
      ...previous,
      ...(path ? { voiceRecordingPath: path } : {}),
      voiceTranscript: result.transcript,
      ...(result.voiceInstruction ? { voiceInstruction: result.voiceInstruction } : {}),
      ...(parsed.data.mode === "scene" && result.movie ? { movie: result.movie } : {}),
      ...(parsed.data.mode === "scene" && result.scene ? { scene: result.scene } : {}),
      ...(parsed.data.mode === "scene" ? { sceneReady: false } : {}),
    } satisfies Record<string, Json | undefined>;
    const { error: updateError } = await admin
      .from("analysis_requests")
      .update({
        draft_data: draftData,
        ...(result.dialogue ? { selected_dialogue: result.dialogue } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id)
      .eq("user_id", user.id);
    if (updateError) {
      if (validAudio && path) await storage.remove([path]);
      throw new Error(`movie_voice_draft_update_failed:${updateError.message}`);
    }
    if (validAudio && previousPath && previousPath !== path) await storage.remove([previousPath]);

    return Response.json({
      ...result,
      voiceUrl: path ? `/api/analyses/${draft.id}/voice?v=${requestId}` : null,
    });
  } catch (error) {
    reportServerError(error, { operation: "movie_voice_transcribe", analysisId: draft.id });
    return Response.json({ error: validAudio ? "That recording could not be transcribed. Try again." : "Those instructions could not be applied. Try again." }, { status: 502 });
  }
}
