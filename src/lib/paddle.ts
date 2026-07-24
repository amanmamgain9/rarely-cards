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

