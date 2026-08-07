import "server-only";

import {
  prepareGeneratedSceneForSeedance,
  prepareImageForSeedance,
} from "@/lib/analysis/image";
import { reportServerError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cancelOrDeleteSeedanceVideo,
  createSeedanceVideo,
} from "@/lib/video/seedance";
import { MOVIE_TRAILER_DURATION_SECONDS } from "@/lib/movie/scenes";

type Submission = {
  generationId: string;
  analysisId: string;
  userId: string;
  photoPath: string;
  prompt: string;
  mode: "pet" | "birthday" | "movie";
};

export async function submitSeedanceVideo({
  generationId,
  analysisId,
  userId,
  photoPath,
  prompt,
  mode,
}: Submission) {
  const admin = createAdminClient();
  let taskId: string | null = null;
  let submissionAttempted = false;

  try {
    const { data: object, error: photoError } = await admin.storage
      .from("analysis-photos")
      .download(photoPath);
    if (photoError || !object) throw new Error("seedance_photo_download_failed");

    const sourceImage = Buffer.from(await object.arrayBuffer());
    const image = mode === "pet"
      ? await prepareImageForSeedance(sourceImage)
      : await prepareGeneratedSceneForSeedance(sourceImage);
    const { data: claim } = await admin
      .from("video_generations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", generationId)
      .eq("status", "submitting")
      .is("discard_requested_at", null)
      .select("id")
      .maybeSingle();
    if (!claim) throw new Error("seedance_submission_cancelled");

    submissionAttempted = true;
    taskId = await createSeedanceVideo({
      image,
      prompt,
      userId,
      generationId,
      durationSeconds: mode === "pet"
        ? 8
        : mode === "movie"
          ? MOVIE_TRAILER_DURATION_SECONDS
          : 10,
    });
    const now = new Date().toISOString();
    const { data: started, error: startError } = await admin
      .from("video_generations")
      .update({
        status: "running",
        provider_task_id: taskId,
        submitted_at: now,
        updated_at: now,
      })
      .eq("id", generationId)
      .eq("status", "submitting")
      .is("discard_requested_at", null)
      .select("id")
      .maybeSingle();
    if (startError || !started) throw new Error("seedance_task_store_failed");

    const { error: consumeError } = await admin.rpc("consume_analysis_credit", {
      p_analysis_id: analysisId,
    });
    if (consumeError) {
      reportServerError(consumeError, {
        operation: "consume_video_credit",
        analysisId,
        generationId,
      });
    }
  } catch (error) {
    const code =
      error instanceof Error && /^seedance_[a-z0-9_]+$/i.test(error.message)
        ? error.message.slice(0, 120)
        : "seedance_submission_failed";
    reportServerError(error, {
      operation: "seedance_video_submit",
      analysisId,
      generationId,
      code,
    });

    const ambiguous = submissionAttempted && !taskId;
    if (ambiguous) {
      await admin
        .from("video_generations")
        .update({
          error_code: "seedance_submission_ambiguous",
          updated_at: new Date().toISOString(),
        })
        .eq("id", generationId)
        .eq("status", "submitting");
      return;
    }

    if (!taskId) {
      await admin
        .from("video_generations")
        .update({
          status: "failed",
          error_code: code,
          updated_at: new Date().toISOString(),
        })
        .eq("id", generationId)
        .in("status", ["submitting", "running"]);
      await admin.rpc("restore_talking_video_credit", {
        p_analysis_id: analysisId,
      });
      return;
    }

    const remoteRemoved = await cancelOrDeleteSeedanceVideo(taskId);
    await admin
      .from("video_generations")
      .update({
        status: remoteRemoved ? "failed" : "running",
        provider_task_id: taskId,
        discard_requested_at: remoteRemoved ? null : new Date().toISOString(),
        error_code: code,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", generationId)
      .in("status", ["submitting", "running"]);
    await admin.rpc("consume_analysis_credit", {
      p_analysis_id: analysisId,
    });
  }
}
