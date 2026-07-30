import "server-only";

import { randomUUID } from "node:crypto";
import { analyzePet } from "@/lib/ai/gemini";
import { inspectImage, prepareImageForGemini } from "@/lib/analysis/image";
import { cardStyleSchema } from "@/lib/analysis/types";
import { startFullRefund } from "@/lib/paddle";
import { reportServerError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

const MAX_JOB_ATTEMPTS = 3;

function safeErrorCode(error: unknown) {
  if (error instanceof Error && error.message === "invalid_model_schema") {
    return "invalid_model_schema";
  }
  if (error instanceof Error && error.message.startsWith("invalid_image")) {
    return "invalid_image";
  }
  const candidate = error as {
    status?: number;
    code?: number | string;
    message?: string;
  };
  const status =
    typeof candidate.status === "number"
      ? candidate.status
      : typeof candidate.code === "number"
        ? candidate.code
        : null;
  if (status && status >= 400 && status <= 599) {
    return `provider_http_${status}`;
  }
  const message = candidate.message ?? "";
  if (/api key.*(invalid|blocked|leak)|invalid.*api key/i.test(message)) {
    return "provider_api_key_invalid";
  }
  if (/quota|resource.?exhausted|rate.?limit/i.test(message)) {
    return "provider_quota_exhausted";
  }
  if (/model.*not found|not found.*model/i.test(message)) {
    return "provider_model_not_found";
  }
  return "provider_or_worker_error";
}

async function claimAnalysis(analysisId: string) {
  const admin = createAdminClient();
  const processingToken = randomUUID();
  const { data, error } = await admin.rpc("claim_analysis_for_processing", {
    p_analysis_id: analysisId,
    p_processing_token: processingToken,
  });
  if (error) throw new Error("analysis_claim_failed");
  const claimed = data?.[0];

  if (!claimed?.object_path) return null;
  return {
    ...claimed,
    object_path: claimed.object_path,
    processingToken,
  };
}

async function recoverExhaustedAnalysis(analysisId: string) {
  const admin = createAdminClient();
  const { data: recovery, error } = await admin.rpc(
    "recover_exhausted_analysis",
    {
      p_analysis_id: analysisId,
      p_error_code: "worker_recovery",
    },
  );
  if (error) {
    reportServerError(error, {
      operation: "analysis_exhausted_recovery",
      analysisId,
    });
    return true;
  }
  if (recovery === "legacy_refund_required") {
    try {
      await startFullRefund(analysisId);
    } catch (refundError) {
      reportServerError(refundError, {
        operation: "analysis_legacy_refund_recovery",
        analysisId,
      });
      await admin
        .from("analysis_requests")
        .update({
          status: "refund_pending",
          error_code: "refund_start_failed",
          expires_at: null,
        })
        .eq("id", analysisId)
        .eq("status", "failed");
    }
    return true;
  }
  return recovery !== "not_exhausted";
}

export async function runAnalysis(analysisId: string): Promise<void> {
  if (await recoverExhaustedAnalysis(analysisId)) return;
  const claimed = await claimAnalysis(analysisId);
  if (!claimed) return;

  const admin = createAdminClient();
  try {
    if (!claimed.pet_name || !claimed.pet_pronouns) {
      throw new Error("invalid_model_schema");
    }

    const { data: object, error: downloadError } = await admin.storage
      .from("analysis-photos")
      .download(claimed.object_path);
    if (downloadError || !object) throw new Error("image_download_failed");

    const original = Buffer.from(await object.arrayBuffer());
    await inspectImage(original);
    const prepared = await prepareImageForGemini(original);
    const style = cardStyleSchema.parse(claimed.card_style);
    const result = await analyzePet({
      image: prepared,
      style,
      petName: claimed.pet_name,
      pronouns: claimed.pet_pronouns,
    });
    if (result.status === "rejected") {
      const { data: finalized, error: finalizeError } = await admin.rpc(
        "finalize_analysis_result",
        {
          p_analysis_id: analysisId,
          p_processing_token: claimed.processingToken,
          p_outcome: "photo_rejected",
          p_result_json: null,
          p_rejection_reason: result.reason,
          p_rejection_message: result.message,
          p_card_photo_path: null,
        },
      );
      if (finalizeError) throw new Error("analysis_finalize_failed");
      if (finalized === "revoked" || finalized === "stale_claim") return;
      if (!["finalized", "already_finalized"].includes(finalized)) {
        throw new Error(`analysis_finalize_${finalized}`);
      }
      return;
    }

    const retainedPath = `${claimed.user_id}/${analysisId}/card-photo.jpg`;
    const retainedBytes = Uint8Array.from(prepared).buffer;
    const { error: retainedPhotoError } = await admin.storage
      .from("analysis-photos")
      .upload(retainedPath, retainedBytes, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: true,
      });
    let cardPhotoPath = claimed.object_path;
    if (!retainedPhotoError) {
      let retainedPhotoIsValid = false;
      const { data: retainedPhoto, error: retainedDownloadError } =
        await admin.storage.from("analysis-photos").download(retainedPath);
      if (!retainedDownloadError && retainedPhoto) {
        try {
          const retained = Buffer.from(await retainedPhoto.arrayBuffer());
          await inspectImage(retained);
          retainedPhotoIsValid = true;
        } catch {
          // Fall back to the validated original when Storage changed the bytes.
        }
      }
      if (retainedPhotoIsValid) {
        cardPhotoPath = retainedPath;
      } else {
        await admin.storage.from("analysis-photos").remove([retainedPath]);
      }
    }

    const { data: finalized, error: finalizeError } = await admin.rpc(
      "finalize_analysis_result",
      {
        p_analysis_id: analysisId,
        p_processing_token: claimed.processingToken,
        p_outcome: "completed",
        p_result_json: result as unknown as Json,
        p_rejection_reason: null,
        p_rejection_message: null,
        p_card_photo_path: cardPhotoPath,
      },
    );
    if (finalizeError) throw new Error("analysis_finalize_failed");
    if (finalized === "revoked" || finalized === "stale_claim") return;
    if (!["finalized", "already_finalized"].includes(finalized)) {
      throw new Error(`analysis_finalize_${finalized}`);
    }
  } catch (error) {
    const code = safeErrorCode(error);
    reportServerError(error, {
      operation: "analysis_attempt",
      analysisId,
      attempt: claimed.attempt_count,
      code,
    });

    if (claimed.attempt_count < MAX_JOB_ATTEMPTS) {
      const { data: retryState, error: retryError } = await admin.rpc(
        "retry_analysis_after_failure",
        {
          p_analysis_id: analysisId,
          p_processing_token: claimed.processingToken,
          p_error_code: code,
        },
      );
      if (retryError) {
        reportServerError(retryError, {
          operation: "analysis_retry_transition",
          analysisId,
        });
      }
      if (retryState === "revoked" || retryState === "stale_claim") return;
      return;
    }

    if (claimed.credit_purchase_id) {
      const { data: restored, error: restoreError } = await admin.rpc(
        "fail_analysis_and_restore_credit",
        {
          p_analysis_id: analysisId,
          p_processing_token: claimed.processingToken,
          p_error_code: code,
        },
      );
      if (restoreError || !["restored", "revoked", "stale_claim"].includes(restored)) {
        reportServerError(restoreError ?? new Error(`credit_restore_${restored}`), {
          operation: "analysis_credit_restore",
          analysisId,
        });
      }
    } else {
      const { data: failed } = await admin
        .from("analysis_requests")
        .update({
          status: "failed",
          processing_started_at: null,
          processing_token: null,
          error_code: code,
          expires_at: null,
        })
        .eq("id", analysisId)
        .eq("status", "processing")
        .eq("processing_token", claimed.processingToken)
        .select("id")
        .maybeSingle();
      if (!failed) return;
      try {
        await startFullRefund(analysisId);
      } catch {
        await admin
          .from("analysis_requests")
          .update({
            status: "refund_pending",
            error_code: "refund_start_failed",
            expires_at: null,
          })
          .eq("id", analysisId)
          .neq("status", "completed");
      }
    }
  }
}
