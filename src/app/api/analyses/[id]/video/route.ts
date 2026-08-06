import { z } from "zod";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { hasSeedanceEnv } from "@/lib/env";
import { seedanceEnv } from "@/lib/env";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  syncSeedanceVideo,
  toPublicVideoGeneration,
} from "@/lib/video/generation";
import { buildPetVideoPrompt } from "@/lib/video/prompt";
import { buildBirthdayVideoPrompt } from "@/lib/birthday/prompt";
import { petDialogueSchema } from "@/lib/video/dialogue";
import {
  DEFAULT_PET_VOICE_ACCENT,
  petVoiceAccentSchema,
} from "@/lib/video/accent";
import { petPronounsSchema } from "@/lib/analysis/types";
import { ensureDevelopmentVideoCredits } from "@/lib/payments/development-credits";
import { submitSeedanceVideo } from "@/lib/video/submission";

const routeIdSchema = z.string().uuid();
type RouteContext = { params: Promise<{ id: string }> };

export const maxDuration = 60;
const AMBIGUOUS_SUBMISSION_TTL_MS = 65 * 60_000;

const VIDEO_SELECT =
  "id, analysis_id, user_id, status, provider_task_id, output_path, error_code, discard_requested_at, attempt_count, created_at, updated_at";
const petVideoSchema = z.object({
  mode: z.literal("pet").optional(),
  dialogue: petDialogueSchema.optional(),
  petName: z.string().trim().min(1).max(30).optional(),
  petPronouns: petPronounsSchema.exclude(["they"]),
  voiceAccent: petVoiceAccentSchema.default(DEFAULT_PET_VOICE_ACCENT),
});
const birthdayVideoSchema = z.object({
  mode: z.literal("birthday"),
  dialogue: petDialogueSchema,
  recipientName: z.string().trim().min(1).max(40),
  voiceAccent: petVoiceAccentSchema.default(DEFAULT_PET_VOICE_ACCENT),
});
const createVideoSchema = z.union([birthdayVideoSchema, petVideoSchema]);

export async function GET(request: Request, context: RouteContext) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!hasSeedanceEnv()) {
    return Response.json({ error: "Pet videos are not enabled." }, { status: 503 });
  }
  const limit = await checkRateLimit({
    request,
    scope: "pet-video-status",
    userId: user.id,
    limit: 30,
    windowSeconds: 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const { id } = await context.params;
  if (!routeIdSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid card." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("video_generations")
    .select(VIDEO_SELECT)
    .eq("analysis_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    return Response.json({ error: "Video status could not be loaded." }, { status: 500 });
  }
  if (!row) {
    return Response.json(null, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (row.status === "running") after(() => syncSeedanceVideo(row.id));
  if (
    row.status === "submitting" &&
    Date.now() - new Date(row.updated_at).getTime() >
      (!row.provider_task_id
        ? AMBIGUOUS_SUBMISSION_TTL_MS
        : 2 * 60_000)
  ) {
    after(async () => {
      const ambiguous = !row.provider_task_id;
      if (ambiguous && !row.discard_requested_at) {
        const { error: restoreError } = await admin.rpc(
          "restore_talking_video_credit",
          {
          p_analysis_id: row.analysis_id,
          },
        );
        if (!restoreError) {
          await admin.from("video_generations").delete().eq("id", row.id);
        }
        return;
      }
      const { data: failed } = await admin
        .from("video_generations")
        .update({
          status: "failed",
          error_code: ambiguous
            ? "seedance_ambiguous_submission_expired"
            : "seedance_submission_interrupted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "submitting")
        .select("analysis_id")
        .maybeSingle();
      if (failed && !ambiguous) {
        await admin.rpc("consume_analysis_credit", {
          p_analysis_id: failed.analysis_id,
        });
      }
    });
  }
  return Response.json(await toPublicVideoGeneration(row), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  await ensureDevelopmentVideoCredits(user.id);
  if (!hasSeedanceEnv()) {
    return Response.json({ error: "Pet videos are not enabled." }, { status: 503 });
  }
  const limit = await checkRateLimit({
    request,
    scope: "pet-video-create",
    userId: user.id,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const { id } = await context.params;
  if (!routeIdSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid card." }, { status: 400 });
  }
  const admin = createAdminClient();
  const body = createVideoSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return Response.json({ error: "Keep your pet's line under 120 characters." }, { status: 400 });
  }
  const { data: analysis } = await admin
    .from("analysis_requests")
    .select("id, user_id, status, card_photo_path, object_path, selected_dialogue, pet_name, pet_pronouns, experience_kind")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (
    !analysis ||
    !["awaiting_name", "paid", "processing", "completed"].includes(analysis.status)
  ) {
    return Response.json({ error: "This photo is not ready for a video." }, { status: 409 });
  }
  const photoPath = analysis.card_photo_path ?? analysis.object_path;
  if (!photoPath) {
    return Response.json({ error: "This pet photo is unavailable." }, { status: 409 });
  }
  const dialogue = body.data.dialogue ?? analysis.selected_dialogue;
  if (!dialogue || !petDialogueSchema.safeParse(dialogue).success) {
    return Response.json({ error: "Choose what your pet should say first." }, { status: 400 });
  }
  const birthdayMode = body.data.mode === "birthday";
  if (
    (birthdayMode && analysis.experience_kind !== "birthday_video") ||
    (!birthdayMode && analysis.experience_kind === "birthday_video")
  ) {
    return Response.json({ error: "This draft belongs to a different studio." }, { status: 409 });
  }

  let { data: row } = await admin
    .from("video_generations")
    .select(VIDEO_SELECT)
    .eq("analysis_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (row?.status === "succeeded" || row?.status === "running" || row?.status === "submitting") {
    return Response.json(await toPublicVideoGeneration(row), {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (row) {
    return Response.json(
      { error: "This video has already used its generation attempt." },
      { status: 409 },
    );
  }

  let petName: string;
  let prompt: string;
  if (body.data.mode === "birthday") {
    petName = `Birthday for ${body.data.recipientName}`.slice(0, 30);
    prompt = buildBirthdayVideoPrompt({
      recipientName: body.data.recipientName,
      dialogue,
      voiceAccent: body.data.voiceAccent,
    });
  } else {
    petName = body.data.petName ?? analysis.pet_name ?? "My pet";
    const petPronouns = body.data.petPronouns;
    const { data: genderSaved, error: genderSaveError } = await admin
      .from("analysis_requests")
      .update({ pet_pronouns: petPronouns })
      .eq("id", id)
      .eq("user_id", user.id)
      .in("status", ["awaiting_name", "paid", "processing", "completed"])
      .select("id")
      .maybeSingle();
    if (genderSaveError || !genderSaved) {
      return Response.json({ error: "This pet is no longer ready for a video." }, { status: 409 });
    }
    prompt = buildPetVideoPrompt({
      petName,
      dialogue,
      petPronouns,
      voiceAccent: body.data.voiceAccent,
    });
  }
  const providerConfig = seedanceEnv();
  const { data: reservation, error: reservationError } = await admin.rpc(
    "reserve_and_create_talking_video",
    {
      p_user_id: user.id,
      p_analysis_id: id,
      p_pet_name: petName,
      p_dialogue: dialogue,
      p_prompt: prompt,
      p_provider_model: providerConfig.model,
      p_pricing_usd_per_million_tokens:
        providerConfig.pricingUsdPerMillionTokens,
    },
  );
  if (reservationError) {
    const { data: raced } = await admin
      .from("video_generations")
      .select(VIDEO_SELECT)
      .eq("analysis_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (raced) return Response.json(await toPublicVideoGeneration(raced));
    return Response.json({ error: "This video needs a video credit." }, { status: 409 });
  }
  const reserved = reservation?.[0];
  if (!reserved?.reserved || !reserved.video_id) {
    return Response.json(
      { error: "Get three talking-pet videos to continue.", needsCredits: true },
      { status: 402 },
    );
  }
  const { data: inserted } = await admin
    .from("video_generations")
    .select(VIDEO_SELECT)
    .eq("id", reserved.video_id)
    .eq("user_id", user.id)
    .single();
  if (!inserted) {
    return Response.json({ error: "Video generation could not start." }, { status: 500 });
  }
  row = inserted;

  after(() =>
    submitSeedanceVideo({
      generationId: row.id,
      analysisId: id,
      userId: user.id,
      photoPath,
      prompt,
      birthdayMode,
    }),
  );
  return Response.json(await toPublicVideoGeneration(row), {
    status: 202,
    headers: { "Cache-Control": "private, no-store" },
  });
}
