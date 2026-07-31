import "server-only";

import type { PaymentProvider } from "@/lib/supabase/database.types";
import { analysisCreditKind } from "@/lib/payments/catalog";
import { createAdminClient } from "@/lib/supabase/admin";

type GrantCreditPurchaseInput = {
  provider: PaymentProvider;
  purchaseId: string;
  userId: string;
  transactionId: string;
  analysisId?: string;
  credits: 3 | 5;
};

export async function grantCreditPurchase(input: GrantCreditPurchaseInput) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("grant_credit_purchase", {
    p_purchase_id: input.purchaseId,
    p_user_id: input.userId,
    p_provider: input.provider,
    p_transaction_id: input.transactionId,
    p_credits: input.credits,
  });
  if (error) throw new Error("webhook_credit_grant_failed");

  let resumedAnalysisId: string | null = null;
  if (input.analysisId) {
    const [{ data: purchase }, { data: analysis }] = await Promise.all([
      admin
        .from("credit_purchases")
        .select("credit_kind")
        .eq("id", input.purchaseId)
        .eq("user_id", input.userId)
        .eq("status", "active")
        .maybeSingle(),
      admin
        .from("analysis_requests")
        .select("experience_kind")
        .eq("id", input.analysisId)
        .eq("user_id", input.userId)
        .eq("status", "awaiting_payment")
        .maybeSingle(),
    ]);
    if (
      !purchase ||
      !analysis ||
      purchase.credit_kind !== analysisCreditKind(analysis.experience_kind)
    ) {
      return { purchaseId: input.purchaseId, analysisId: null };
    }
    const { data: resumed, error: resumeError } = await admin
      .from("analysis_requests")
      .update({ status: "awaiting_name", error_code: null })
      .eq("id", input.analysisId)
      .eq("user_id", input.userId)
      .eq("status", "awaiting_payment")
      .select("id")
      .maybeSingle();
    if (resumeError) throw new Error("webhook_resume_analysis_failed");
    resumedAnalysisId = resumed?.id ?? null;
  }

  return { purchaseId: input.purchaseId, analysisId: resumedAnalysisId };
}

export async function resumeAnalysisAfterGrantedPurchase(input: {
  userId: string;
  analysisId: string;
}) {
  const admin = createAdminClient();
  const { data: analysis, error: analysisError } = await admin
    .from("analysis_requests")
    .select("experience_kind")
    .eq("id", input.analysisId)
    .eq("user_id", input.userId)
    .eq("status", "awaiting_payment")
    .maybeSingle();
  if (analysisError || !analysis) return false;
  const requiredKind = analysisCreditKind(analysis.experience_kind);
  const { data: completedPurchase, error: purchaseError } = await admin
    .from("credit_purchases")
    .select("id")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .eq("credit_kind", requiredKind)
    .gt("credits_remaining", 0)
    .limit(1)
    .maybeSingle();
  if (purchaseError || !completedPurchase) return false;

  const { data: resumed, error: resumeError } = await admin
    .from("analysis_requests")
    .update({ status: "awaiting_name", error_code: null })
    .eq("id", input.analysisId)
    .eq("user_id", input.userId)
    .eq("status", "awaiting_payment")
    .select("id")
    .maybeSingle();
  if (resumeError) throw new Error("purchase_analysis_resume_failed");

  return Boolean(resumed);
}
