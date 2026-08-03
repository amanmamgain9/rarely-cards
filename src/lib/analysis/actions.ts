import { inspectImage } from "@/lib/analysis/image";
import { hasSeedanceEnv } from "@/lib/env";
import { developmentVideoCreditBalance } from "@/lib/payments/development-credits";
import { createAdminClient } from "@/lib/supabase/admin";

export class AnalysisActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export type AnalysisActionResult = {
  payload: Record<string, unknown>;
  runInBackground?: boolean;
};

export async function startTalkingVideo(input: {
  userId: string;
  analysisId: string;
  petName: string;
  dialogue: string;
}): Promise<AnalysisActionResult> {
  if (!hasSeedanceEnv()) {
    throw new AnalysisActionError("Talking-pet videos are not enabled yet.", 503);
  }

  const admin = createAdminClient();
  const { data: reservation, error } = await admin.rpc(
    "reserve_talking_video_credit",
    {
      p_user_id: input.userId,
      p_analysis_id: input.analysisId,
      p_pet_name: input.petName,
      p_dialogue: input.dialogue,
    },
  );
  if (error) {
    throw new AnalysisActionError("This pet is not waiting for a line.", 409);
  }

  const reserved = reservation?.[0];
  if (!reserved?.reserved) {
    await admin
      .from("analysis_requests")
      .update({
        status: "awaiting_payment",
        pet_name: input.petName,
        pet_pronouns: "they",
        selected_dialogue: input.dialogue,
      })
      .eq("id", input.analysisId)
      .eq("user_id", input.userId)
      .in("status", ["awaiting_name", "awaiting_payment"]);
    throw new AnalysisActionError(
      "Get three talking-pet videos to continue.",
      402,
      { needsCredits: true, creditBalance: 0 },
    );
  }

  return {
    payload: {
      id: input.analysisId,
      status: "paid",
      creditBalance: developmentVideoCreditBalance(reserved.remaining_balance),
    },
    runInBackground: true,
  };
}

export async function confirmAnalysisUpload(input: {
  userId: string;
  analysisId: string;
}): Promise<AnalysisActionResult> {
  const admin = createAdminClient();
  const { data: analysis, error } = await admin
    .from("analysis_requests")
    .select("id, user_id, status, object_path, paddle_transaction_id")
    .eq("id", input.analysisId)
    .single();

  if (error || !analysis || analysis.user_id !== input.userId) {
    throw new AnalysisActionError("Analysis not found.", 404);
  }
  if (analysis.status !== "awaiting_upload" || !analysis.object_path) {
    throw new AnalysisActionError("This upload is no longer expected.", 409);
  }

  const { data: object, error: downloadError } = await admin.storage
    .from("analysis-photos")
    .download(analysis.object_path);
  if (downloadError || !object) {
    throw new AnalysisActionError("Upload not found. Please try again.", 409);
  }

  try {
    const image = await inspectImage(Buffer.from(await object.arrayBuffer()));
    const { data: purchases } = await admin
      .from("credit_purchases")
      .select("credits_remaining, credit_kind")
      .eq("user_id", input.userId)
      .eq("status", "active");
    const hasVideoCredits =
      (purchases ?? []).reduce(
        (sum, purchase) =>
          sum +
          (purchase.credit_kind === "talking_video"
            ? purchase.credits_remaining
            : 0),
        0,
      ) > 0;
    const nextStatus = hasVideoCredits ? "awaiting_name" : "awaiting_payment";
    const { data: updated, error: updateError } = await admin
      .from("analysis_requests")
      .update({
        status: nextStatus,
        image_mime_type: image.mimeType,
        image_bytes: image.bytes,
        image_width: image.width,
        image_height: image.height,
        photo_uploaded_at: new Date().toISOString(),
        expires_at: null,
        rejection_reason: null,
        rejection_message: null,
      })
      .eq("id", input.analysisId)
      .eq("status", "awaiting_upload")
      .select("status")
      .single();
    if (updateError || !updated) {
      throw new AnalysisActionError(
        "Upload state changed. Refresh and try again.",
        409,
      );
    }

    return {
      payload: {
        id: input.analysisId,
        status: updated.status,
        needsCredits: updated.status === "awaiting_payment",
        hasVideoCredits,
      },
      runInBackground: updated.status === "paid",
    };
  } catch (error) {
    if (error instanceof AnalysisActionError) throw error;
    await admin.storage.from("analysis-photos").remove([analysis.object_path]);
    await admin
      .from("analysis_requests")
      .update({
        object_path: null,
        image_mime_type: null,
        image_bytes: null,
        image_width: null,
        image_height: null,
        status: analysis.paddle_transaction_id ? "photo_rejected" : "awaiting_upload",
        rejection_reason: "invalid_file",
        rejection_message:
          "That file is not a usable JPEG, PNG, or WebP. Choose a clear photo and try again.",
      })
      .eq("id", input.analysisId)
      .eq("status", "awaiting_upload");
    throw new AnalysisActionError(
      "Choose a valid JPEG, PNG, or WebP between 256px and 6000px.",
      422,
    );
  }
}
