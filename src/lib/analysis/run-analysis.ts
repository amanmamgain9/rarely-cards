import "server-only";

import { analyzePet } from "@/lib/ai/gemini";
import { inspectImage, prepareImageForGemini } from "@/lib/analysis/image";
import { cardStyleSchema } from "@/lib/analysis/types";
import { startFullRefund } from "@/lib/paddle";
import { reportServerError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

const STALE_PROCESSING_MS = 10 * 60 * 1000;
const MAX_JOB_ATTEMPTS = 3;

function safeErrorCode(error: unknown) {
  if (error instanceof Error && error.message === "invalid_model_schema") {
    return "invalid_model_schema";
  }
  if (error instanceof Error && error.message.startsWith("invalid_image")) {
    return "invalid_image";
  }
  return "provider_or_worker_error";
}

async function claimAnalysis(analysisId: string) {
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("analysis_requests")
    .select(
      "id, user_id, status, version, attempt_count, object_path, card_style, pet_name, pet_pronouns, processing_started_at, paddle_transaction_id, credit_purchase_id, credit_state",
    )
    .eq("id", analysisId)
    .single();

  const hasEntitlement =
    Boolean(current?.paddle_transaction_id) ||
    (Boolean(current?.credit_purchase_id) &&
      ["reserved", "consumed"].includes(current?.credit_state ?? ""));
  if (!current || !hasEntitlement || !current.object_path) return null;
  const stale =
    current.status === "processing" &&
    current.processing_started_at &&
    Date.now() - new Date(current.processing_started_at).getTime() >
      STALE_PROCESSING_MS;
  if (current.status !== "paid" && !stale) return null;

  const { data: claimed } = await admin
    .from("analysis_requests")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      attempt_count: current.attempt_count + 1,
      error_code: null,
    })
    .eq("id", analysisId)
    .eq("version", current.version)
    .select(
      "id, user_id, object_path, card_style, pet_name, pet_pronouns, attempt_count, credit_purchase_id",
    )
    .maybeSingle();

  if (!claimed?.object_path) return null;
  return {
    ...claimed,
    object_path: claimed.object_path,
  };
}

export async function runAnalysis(analysisId: string): Promise<void> {
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
    if (claimed.credit_purchase_id) {
      const { error: creditError } = await admin.rpc(
        "consume_analysis_credit",
        { p_analysis_id: analysisId },
      );
      if (creditError) throw new Error("credit_finalize_failed");
    }
    if (result.status === "rejected") {
      await admin
        .from("analysis_requests")
        .update({
          status: "photo_rejected",
          result_json: null,
          rejection_reason: result.reason,
          rejection_message: result.message,
          processing_started_at: null,
          expires_at: null,
        })
        .eq("id", analysisId)
        .eq("status", "processing");
      return;
    }

    const retainedPath = `${claimed.user_id}/${analysisId}/card-photo.jpg`;
    const { error: retainedPhotoError } = await admin.storage
      .from("analysis-photos")
      .upload(retainedPath, prepared, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: true,
      });
    const cardPhotoPath = retainedPhotoError
      ? claimed.object_path
      : retainedPath;

    await admin
      .from("analysis_requests")
      .update({
        status: "completed",
        card_photo_path: cardPhotoPath,
        result_json: result as unknown as Json,
        rejection_reason: null,
        rejection_message: null,
        completed_at: new Date().toISOString(),
        processing_started_at: null,
        expires_at: null,
      })
      .eq("id", analysisId)
      .eq("status", "processing");
  } catch (error) {
    const code = safeErrorCode(error);
    reportServerError(error, {
      operation: "analysis_attempt",
      analysisId,
      attempt: claimed.attempt_count,
      code,
    });

    if (claimed.attempt_count < MAX_JOB_ATTEMPTS) {
      await admin
        .from("analysis_requests")
        .update({
          status: "paid",
          processing_started_at: null,
          error_code: code,
        })
        .eq("id", analysisId)
        .eq("status", "processing");
      return;
    }

    await admin
      .from("analysis_requests")
      .update({
        status: "failed",
        processing_started_at: null,
        error_code: code,
      })
      .eq("id", analysisId)
      .eq("status", "processing");

    if (claimed.credit_purchase_id) {
      const { error: restoreError } = await admin.rpc(
        "restore_analysis_credit",
        { p_analysis_id: analysisId },
      );
      await admin
        .from("analysis_requests")
        .update({
          error_code: restoreError ? "credit_restore_failed" : code,
          expires_at: null,
        })
        .eq("id", analysisId);
    } else {
      try {
        await startFullRefund(analysisId);
        await admin
          .from("analysis_requests")
          .update({ expires_at: null })
          .eq("id", analysisId);
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

