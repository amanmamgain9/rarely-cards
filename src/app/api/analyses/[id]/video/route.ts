import { z } from "zod";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { prepareImageForSeedance } from "@/lib/analysis/image";
import { acceptedAnalysisSchema } from "@/lib/analysis/types";
import { hasSeedanceEnv } from "@/lib/env";
import { seedanceEnv } from "@/lib/env";
import { reportServerError } from "@/lib/observability";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  syncSeedanceVideo,
  toPublicVideoGeneration,
} from "@/lib/video/generation";
import { buildPetVideoPrompt } from "@/lib/video/prompt";
import {
  cancelOrDeleteSeedanceVideo,
  createSeedanceVideo,
} from "@/lib/video/seedance";
import { petDialogueSchema } from "@/lib/video/dialogue";

const routeIdSchema = z.string().uuid();
type RouteContext = { params: Promise<{ id: string }> };

export const maxDuration = 60;
const AMBIGUOUS_SUBMISSION_TTL_MS = 65 * 60_000;

const VIDEO_SELECT =
  "id, analysis_id, user_id, status, provider_task_id, output_path, error_code, discard_requested_at, attempt_count, created_at, updated_at";
const createVideoSchema = z.object({
  dialogue: petDialogueSchema.optional(),
  petName: z.string().trim().min(1).max(30).optional(),
});

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
        await admin.rpc("restore_talking_video_credit", {
          p_analysis_id: failed.analysis_id,
        });
      }
    });
  }
  if (row.status === "failed" && !row.discard_requested_at && row.error_code !== "discarded_by_user") {
    after(() =>
      admin.rpc("restore_talking_video_credit", { p_analysis_id: row.analysis_id }),
    );
  }
  return Response.json(await toPublicVideoGeneration(row), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
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
    .select("id, user_id, status, result_json, card_photo_path, object_path, selected_dialogue, pet_name, credit_purchase_id, credit_state")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!analysis || analysis.status !== "completed") {
    return Response.json({ error: "Finish preparing this photo before making its video." }, { status: 409 });
  }
  const photoPath = analysis.card_photo_path ?? analysis.object_path;
  if (!photoPath) {
    return Response.json({ error: "This pet photo is unavailable." }, { status: 409 });
  }
  const result = acceptedAnalysisSchema.safeParse(analysis.result_json);
  if (!result.success) {
    return Response.json({ error: "This photo cannot be animated." }, { status: 409 });
  }
  // Once a line has bought the video attempt, the video must use that
  // exact line. The optional body value only supports older completed cards
  // that have not selected dialogue yet.
  const dialogue = analysis.selected_dialogue ?? body.data.dialogue;
  if (!dialogue || !petDialogueSchema.safeParse(dialogue).success) {
    return Response.json({ error: "Choose what your pet should say first." }, { status: 400 });
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

  const prompt = buildPetVideoPrompt(result.data, dialogue);
  const providerConfig = seedanceEnv();
  const { data: reservation, error: reservationError } = await admin.rpc(
    "reserve_and_create_talking_video",
    {
      p_user_id: user.id,
      p_analysis_id: id,
      p_pet_name: body.data.petName ?? analysis.pet_name ?? "My pet",
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

  let createdTaskId: string | null = null;
  let submissionAttempted = false;
  try {
    const { data: object, error: photoError } = await admin.storage
      .from("analysis-photos")
      .download(photoPath);
    if (photoError || !object) throw new Error("seedance_photo_download_failed");
    const image = await prepareImageForSeedance(
      Buffer.from(await object.arrayBuffer()),
    );
    const { data: submissionClaim } = await admin
      .from("video_generations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "submitting")
      .is("discard_requested_at", null)
      .select("id")
      .maybeSingle();
    if (!submissionClaim) {
      const { error: restoreError } = await admin.rpc(
        "restore_talking_video_credit",
        { p_analysis_id: id },
      );
      if (!restoreError) {
        await admin.from("video_generations").delete().eq("id", row.id);
      }
      return Response.json(
        { error: "This video was canceled before generation started." },
        { status: 409 },
      );
    }
    submissionAttempted = true;
    const taskId = await createSeedanceVideo({
      image,
      prompt,
      userId: user.id,
      generationId: row.id,
    });
    createdTaskId = taskId;
    const { data: started, error: startError } = await admin
      .from("video_generations")
      .update({
        status: "running",
        provider_task_id: taskId,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .in("status", ["submitting", "running"])
      .is("discard_requested_at", null)
      .select(VIDEO_SELECT)
      .maybeSingle();
    if (startError || !started) throw new Error("seedance_task_store_failed");
    return Response.json(await toPublicVideoGeneration(started), {
      status: 202,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const code =
      error instanceof Error && /^seedance_[a-z0-9_]+$/i.test(error.message)
        ? error.message.slice(0, 120)
        : "seedance_submission_failed";
    reportServerError(error, {
      operation: "seedance_video_submit",
      analysisId: id,
      attempt: row.attempt_count,
      code,
    });
    const ambiguousSubmission =
      submissionAttempted && !createdTaskId;
    const remoteRemoved = createdTaskId
      ? await cancelOrDeleteSeedanceVideo(createdTaskId)
      : !ambiguousSubmission;
    const { data: failed } = ambiguousSubmission
      ? await admin
          .from("video_generations")
          .update({
            status: "submitting",
            error_code: "seedance_submission_ambiguous",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("status", "submitting")
          .select("id")
          .maybeSingle()
      : remoteRemoved
      ? await admin
          .from("video_generations")
          .update({
            status: "failed",
            error_code: code,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .in("status", ["submitting", "running"])
          .select("id")
          .maybeSingle()
      : await admin
          .from("video_generations")
          .update({
            status: "running",
            provider_task_id: createdTaskId,
            discard_requested_at: new Date().toISOString(),
            error_code: code,
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .in("status", ["submitting", "running"])
          .select("id")
          .maybeSingle();
    if (failed && remoteRemoved && !ambiguousSubmission) {
      await admin.rpc("restore_talking_video_credit", { p_analysis_id: id });
    }
    if (failed && remoteRemoved && !ambiguousSubmission) {
      // No provider task was returned, so this is a technical pre-task
      // failure rather than a paid reroll. The restored credit may retry it.
      await admin.from("video_generations").delete().eq("id", failed.id);
    }
    return Response.json(
      { error: "The video could not start. Try again." },
      { status: 502 },
    );
  }
}
