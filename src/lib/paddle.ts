import "server-only";

import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

let paddleClient: Paddle | null = null;

export function getPaddle() {
  if (!paddleClient) {
    const env = serverEnv();
    paddleClient = new Paddle(env.paddleApiKey, {
      environment:
        env.paddleEnvironment === "production"
          ? Environment.production
          : Environment.sandbox,
    });
  }
  return paddleClient;
}

export async function startFullRefund(
  analysisId: string,
  reason = "Rarely analysis could not be completed after retries",
) {
  const admin = createAdminClient();
  const { data: analysis, error } = await admin
    .from("analysis_requests")
    .select("id, status, paddle_transaction_id, paddle_adjustment_id")
    .eq("id", analysisId)
    .single();

  if (error || !analysis?.paddle_transaction_id) {
    throw new Error("refund_analysis_not_found");
  }
  if (analysis.paddle_adjustment_id) return analysis.paddle_adjustment_id;
  if (analysis.status === "completed" || analysis.status === "disputed") {
    throw new Error("refund_not_allowed");
  }

  await admin
    .from("analysis_requests")
    .update({ status: "refund_pending", error_code: "refund_requested" })
    .eq("id", analysisId)
    .neq("status", "completed");

  const adjustment = await getPaddle().adjustments.create({
    action: "refund",
    type: "full",
    transactionId: analysis.paddle_transaction_id,
    reason,
  });

  const refunded = adjustment.status === "approved";
  await admin
    .from("analysis_requests")
    .update({
      status: refunded ? "refunded" : "refund_pending",
      paddle_adjustment_id: adjustment.id,
      refunded_at: refunded ? new Date().toISOString() : null,
      error_code: refunded ? null : "refund_pending_approval",
    })
    .eq("id", analysisId);

  return adjustment.id;
}

export async function startCreditPurchaseRefund(
  purchaseId: string,
  userId: string,
  reason = "Rarely 14-day money-back guarantee",
) {
  const admin = createAdminClient();
  const { data: purchase, error } = await admin
    .from("credit_purchases")
    .select(
      "id, user_id, status, completed_at, paddle_transaction_id, paddle_adjustment_id",
    )
    .eq("id", purchaseId)
    .eq("user_id", userId)
    .single();

  if (error || !purchase?.paddle_transaction_id || !purchase.completed_at) {
    throw new Error("refund_purchase_not_found");
  }
  if (
    Date.now() - new Date(purchase.completed_at).getTime() >
    14 * 24 * 60 * 60 * 1000
  ) {
    throw new Error("refund_window_closed");
  }
  if (purchase.status === "refunded") {
    return { adjustmentId: purchase.paddle_adjustment_id, status: "refunded" };
  }
  if (purchase.status === "refund_pending") {
    return {
      adjustmentId: purchase.paddle_adjustment_id,
      status: "refund_pending",
    };
  }
  if (purchase.status !== "active") throw new Error("refund_not_allowed");

  const { data: frozen } = await admin
    .from("credit_purchases")
    .update({
      status: "refund_pending",
      refund_requested_at: new Date().toISOString(),
    })
    .eq("id", purchase.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (!frozen) throw new Error("refund_state_conflict");

  try {
    const adjustment = await getPaddle().adjustments.create({
      action: "refund",
      type: "full",
      transactionId: purchase.paddle_transaction_id,
      reason,
    });
    const refunded = adjustment.status === "approved";
    await admin
      .from("credit_purchases")
      .update({
        status: refunded ? "refunded" : "refund_pending",
        credits_remaining: refunded ? 0 : undefined,
        paddle_adjustment_id: adjustment.id,
        refunded_at: refunded ? new Date().toISOString() : null,
      })
      .eq("id", purchase.id);
    return {
      adjustmentId: adjustment.id,
      status: refunded ? "refunded" : "refund_pending",
    };
  } catch (error) {
    // Keep credits frozen: a timed-out Paddle request may still have succeeded
    // and its webhook will settle the final refund state.
    throw error;
  }
}

