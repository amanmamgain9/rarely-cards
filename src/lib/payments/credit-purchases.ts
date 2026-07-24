import "server-only";

import type { PaymentProvider } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

type GrantCreditPurchaseInput = {
  provider: PaymentProvider;
  purchaseId: string;
  userId: string;
  transactionId: string;
  analysisId?: string;
};

export async function grantCreditPurchase(input: GrantCreditPurchaseInput) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("grant_credit_purchase", {
    p_purchase_id: input.purchaseId,
    p_user_id: input.userId,
    p_provider: input.provider,
    p_transaction_id: input.transactionId,
    p_credits: 5,
  });
  if (error) throw new Error("webhook_credit_grant_failed");

  let resumedAnalysisId: string | null = null;
  if (input.analysisId) {
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
