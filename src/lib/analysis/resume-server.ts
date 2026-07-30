import "server-only";

import {
  analysisStatusSchema,
  cardStyleSchema,
  type PublicAnalysis,
} from "@/lib/analysis/types";
import { RESUMABLE_ANALYSIS_STATUSES } from "@/lib/analysis/resume";
import { resumeAnalysisAfterGrantedPurchase } from "@/lib/payments/credit-purchases";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getLatestResumableAnalysis(
  userId: string,
): Promise<PublicAnalysis | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("analysis_requests")
    .select(
      "id, card_style, status, rejection_message, replacement_count, created_at, updated_at, object_path",
    )
    .eq("user_id", userId)
    .in("status", [...RESUMABLE_ANALYSIS_STATUSES])
    .not("photo_uploaded_at", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`resume_analysis_unavailable:${error.code}`);
  if (!data) return null;

  let status = analysisStatusSchema.parse(data.status);
  if (status === "awaiting_payment") {
    const resumed = await resumeAnalysisAfterGrantedPurchase({
      userId,
      analysisId: data.id,
    });
    if (resumed) status = "awaiting_name";
  }
  let photoUrl: string | null = null;
  if (data.object_path) {
    const { data: signedPhoto, error: signedPhotoError } = await admin.storage
      .from("analysis-photos")
      .createSignedUrl(data.object_path, 60 * 60);
    if (signedPhotoError) {
      throw new Error("resume_photo_unavailable");
    }
    photoUrl = signedPhoto.signedUrl;
  }

  if (!photoUrl) throw new Error("resume_photo_unavailable");

  return {
    id: data.id,
    cardStyle: cardStyleSchema.parse(data.card_style),
    status,
    result: null,
    rejectionMessage: data.rejection_message,
    replacementCount: data.replacement_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    photoUrl,
    refundState: status === "refund_pending" ? "pending" : "none",
  };
}
