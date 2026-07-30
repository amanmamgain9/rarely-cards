import "server-only";

import {
  analysisStatusSchema,
  cardStyleSchema,
  type PublicAnalysis,
} from "@/lib/analysis/types";
import { isResumableAnalysisStatus } from "@/lib/analysis/resume";
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
    .not("photo_uploaded_at", "is", null)
    // Decide from the newest card attempt. Filtering to unfinished rows first
    // can resurrect an older abandoned flow after a newer card was completed.
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`resume_analysis_unavailable:${error.code}`);
  if (!data) return null;

  let status = analysisStatusSchema.parse(data.status);
  if (!isResumableAnalysisStatus(status)) return null;
  if (status === "awaiting_payment") {
    const resumed = await resumeAnalysisAfterGrantedPurchase({
      userId,
      analysisId: data.id,
    });
    if (resumed) status = "awaiting_name";
  }
  if (!data.object_path) throw new Error("resume_photo_unavailable");
  const photoUrl = `/api/analyses/${data.id}/photo`;

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
