import "server-only";

import { DRAFT_ANALYSIS_STATUSES } from "@/lib/analysis/resume";
import { reportServerError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelOrDeleteSeedanceVideo } from "@/lib/video/seedance";

export class AnalysisDeleteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function uniquePaths(paths: Array<string | null>) {
  return Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
}

export async function deleteDraft(userId: string, analysisId: string) {
  const admin = createAdminClient();
  const { data: draft, error } = await admin
    .from("analysis_requests")
    .delete()
    .eq("id", analysisId)
    .eq("user_id", userId)
    .eq("experience_kind", "talking_video")
    .in("status", [...DRAFT_ANALYSIS_STATUSES])
    .not("object_path", "is", null)
    .select("card_photo_path, object_path")
    .maybeSingle();

  if (error) throw new AnalysisDeleteError("The draft could not be deleted.", 502);
  if (!draft) {
    throw new AnalysisDeleteError(
      "This item is no longer an editable draft.",
      409,
    );
  }
  return uniquePaths([draft.card_photo_path, draft.object_path]);
}

export async function deleteDraftPhotos(
  analysisId: string,
  photoPaths: string[],
) {
  const { error } = await createAdminClient().storage
    .from("analysis-photos")
    .remove(photoPaths);
  if (error) {
    reportServerError(error, {
      operation: "draft_photo_cleanup",
      analysisId,
    });
  }
}

export async function deleteSavedAnalysis(userId: string, analysisId: string) {
  const admin = createAdminClient();
  const { data: analysis } = await admin
    .from("analysis_requests")
    .select("id, card_photo_path, object_path")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!analysis) throw new AnalysisDeleteError("Card not found.", 404);

  const savedPhotoPaths = uniquePaths([
    analysis.card_photo_path,
    analysis.object_path,
  ]);
  if (savedPhotoPaths.length === 0) {
    throw new AnalysisDeleteError("This card has no saved photo.", 409);
  }

  const { data: video, error: videoLookupError } = await admin
    .from("video_generations")
    .select("id, status, provider_task_id, error_code, discard_requested_at")
    .eq("analysis_id", analysisId)
    .eq("user_id", userId)
    .maybeSingle();
  if (videoLookupError) {
    throw new AnalysisDeleteError(
      "Saved video state could not be checked.",
      502,
    );
  }

  if (!video) {
    await admin.rpc("restore_talking_video_credit", {
      p_analysis_id: analysisId,
    });
  }
  if (video) {
    if (video.provider_task_id) {
      await cancelOrDeleteSeedanceVideo(video.provider_task_id);
    }
    const { error } = await admin
      .from("video_generations")
      .update({
        discard_requested_at: new Date().toISOString(),
        output_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", video.id)
      .eq("user_id", userId);
    if (error) {
      throw new AnalysisDeleteError(
        "Saved photo and video could not be deleted.",
        502,
      );
    }
  }

  const { error: videoStorageError } = await admin.storage
    .from("generated-videos")
    .remove([`${userId}/${analysisId}/seedance.mp4`]);
  if (videoStorageError) {
    throw new AnalysisDeleteError(
      "Saved photo and video could not be deleted.",
      502,
    );
  }

  const photoPaths = uniquePaths([
    ...savedPhotoPaths,
    `${userId}/${analysisId}/zazzle-card.png`,
  ]);
  const { error: photoStorageError } = await admin.storage
    .from("analysis-photos")
    .remove(photoPaths);
  if (photoStorageError) {
    throw new AnalysisDeleteError("Photo could not be deleted.", 502);
  }

  await admin
    .from("analysis_requests")
    .update({ card_photo_path: null, object_path: null })
    .eq("id", analysisId)
    .eq("user_id", userId);
}
