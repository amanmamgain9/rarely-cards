import "server-only";

import { randomUUID } from "node:crypto";
import { ApiError, Environment, Paddle } from "@paddle/paddle-node-sdk";
import { paddleEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

let paddleClient: Paddle | null = null;

export function getPaddle() {
  if (!paddleClient) {
    const env = paddleEnv();
    paddleClient = new Paddle(env.paddleApiKey, {
      environment:
        env.paddleEnvironment === "production"
          ? Environment.production
          : Environment.sandbox,
    });
  }
  return paddleClient;
}

async function findPaddleCustomerId(email: string) {
  const customers = getPaddle().customers.list({
    email: [email],
    perPage: 1,
  });
  for await (const customer of customers) return customer.id;
  return null;
}

export async function getOrCreatePaddleCustomerId(
  userId: string,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingCustomerId = await findPaddleCustomerId(normalizedEmail);
  if (existingCustomerId) return existingCustomerId;

  try {
    const customer = await getPaddle().customers.create({
      email: normalizedEmail,
      customData: { user_id: userId },
    });
    return customer.id;
  } catch (error) {
    // Two checkout requests can race after the lookup. Paddle keeps customer
    // emails unique, so recover by loading the customer created by the winner.
    if (error instanceof ApiError && error.code === "customer_already_exists") {
      const racedCustomerId = await findPaddleCustomerId(normalizedEmail);
      if (racedCustomerId) return racedCustomerId;
    }
    throw error;
  }
}

type LegacyRefundState = {
  adjustmentId: string;
  status: "pending" | "refunded" | "rejected" | "reversed";
};

async function findLegacyRefund(transactionId: string, adjustmentId?: string) {
  const adjustments = getPaddle().adjustments.list({
    action: "refund",
    transactionId: [transactionId],
    perPage: 50,
  });
  for await (const adjustment of adjustments) {
    if (adjustmentId && adjustment.id !== adjustmentId) continue;
    if (
      !["approved", "pending_approval", "rejected", "reversed"].includes(
        adjustment.status,
      )
    ) {
      continue;
    }
    if (
      !adjustmentId &&
      (adjustment.status === "rejected" || adjustment.status === "reversed")
    ) {
      continue;
    }
    return {
      adjustmentId: adjustment.id,
      status:
        adjustment.status === "approved"
          ? "refunded"
          : adjustment.status === "rejected"
            ? "rejected"
            : adjustment.status === "reversed"
              ? "reversed"
              : "pending",
    } satisfies LegacyRefundState;
  }
  return null;
}

export async function startFullRefund(
  analysisId: string,
  reason = "Rarely analysis could not be completed after retries",
) {
  const admin = createAdminClient();
  const { data: analysis, error } = await admin
    .from("analysis_requests")
    .select(
      "id, status, paddle_transaction_id, paddle_adjustment_id, refund_attempt_id, refund_attempted_at",
    )
    .eq("id", analysisId)
    .single();

  if (error || !analysis?.paddle_transaction_id) {
    throw new Error("refund_analysis_not_found");
  }
  if (analysis.status === "completed" || analysis.status === "disputed") {
    throw new Error("refund_not_allowed");
  }
  if (analysis.status === "refunded" && !analysis.paddle_adjustment_id) {
    return `refunded:${analysis.paddle_transaction_id}`;
  }

  if (analysis.paddle_adjustment_id) {
    const existing = await findLegacyRefund(
      analysis.paddle_transaction_id,
      analysis.paddle_adjustment_id,
    );
    if (existing?.status === "refunded") {
      const { error: settledError } = await admin
        .from("analysis_requests")
        .update({
          status: "refunded",
          refunded_at: new Date().toISOString(),
          refund_attempt_id: null,
          refund_attempted_at: new Date().toISOString(),
          error_code: null,
        })
        .eq("id", analysisId)
        .eq("paddle_adjustment_id", existing.adjustmentId);
      if (settledError) throw new Error("refund_persistence_unconfirmed");
      return existing.adjustmentId;
    }
    if (existing?.status === "pending") {
      await admin
        .from("analysis_requests")
        .update({ refund_attempted_at: new Date().toISOString() })
        .eq("id", analysisId)
        .eq("paddle_adjustment_id", existing.adjustmentId);
      return existing.adjustmentId;
    }
    if (existing?.status === "rejected" || existing?.status === "reversed") {
      const { error: resetError } = await admin
        .from("analysis_requests")
        .update({
          status: "refund_pending",
          paddle_adjustment_id: null,
          refund_attempt_id: null,
          refund_attempted_at: null,
          error_code: "refund_rejected_retry",
        })
        .eq("id", analysisId)
        .eq("paddle_adjustment_id", existing.adjustmentId);
      if (resetError) throw new Error("refund_persistence_unconfirmed");
    } else {
      throw new Error("refund_provider_unconfirmed");
    }
  }

  const attemptId = randomUUID();
  const attemptedAt = new Date().toISOString();
  let { data: claimed } = await admin
    .from("analysis_requests")
    .update({
      status: "refund_pending",
      refund_attempt_id: attemptId,
      refund_attempted_at: attemptedAt,
      error_code: "refund_requested",
    })
    .eq("id", analysisId)
    .in("status", [
      "awaiting_name",
      "paid",
      "photo_rejected",
      "failed",
      "refund_pending",
    ])
    .is("paddle_adjustment_id", null)
    .is("refund_attempt_id", null)
    .select("id")
    .maybeSingle();
  if (!claimed) {
    const staleCutoff = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: staleClaim } = await admin
      .from("analysis_requests")
      .update({
        status: "refund_pending",
        refund_attempt_id: attemptId,
        refund_attempted_at: attemptedAt,
        error_code: "refund_reconciling",
      })
      .eq("id", analysisId)
      .eq("status", "refund_pending")
      .is("paddle_adjustment_id", null)
      .lt("refund_attempted_at", staleCutoff)
      .select("id")
      .maybeSingle();
    claimed = staleClaim;
  }
  if (!claimed) throw new Error("refund_retry_later");

  let providerRefund: LegacyRefundState | null = null;
  try {
    providerRefund = await findLegacyRefund(analysis.paddle_transaction_id);
    if (!providerRefund) {
      const adjustment = await getPaddle().adjustments.create({
        action: "refund",
        type: "full",
        transactionId: analysis.paddle_transaction_id,
        reason,
      });
      providerRefund = {
        adjustmentId: adjustment.id,
        status:
          adjustment.status === "approved"
            ? "refunded"
            : adjustment.status === "rejected"
              ? "rejected"
              : adjustment.status === "reversed"
                ? "reversed"
                : "pending",
      };
    }
  } catch (providerError) {
    await admin
      .from("analysis_requests")
      .update({ error_code: "refund_start_failed" })
      .eq("id", analysisId)
      .eq("refund_attempt_id", attemptId);
    throw providerError;
  }

  if (providerRefund.status === "rejected" || providerRefund.status === "reversed") {
    const { data: reset, error: resetError } = await admin
      .from("analysis_requests")
      .update({
        status: "refund_pending",
        paddle_adjustment_id: null,
        refund_attempt_id: null,
        refund_attempted_at: null,
        error_code: "refund_rejected_retry",
      })
      .eq("id", analysisId)
      .eq("refund_attempt_id", attemptId)
      .select("id")
      .maybeSingle();
    if (resetError || !reset) throw new Error("refund_persistence_unconfirmed");
    throw new Error("refund_rejected");
  }

  const refunded = providerRefund.status === "refunded";
  const { data: saved, error: saveError } = await admin
    .from("analysis_requests")
    .update({
      status: refunded ? "refunded" : "refund_pending",
      paddle_adjustment_id: providerRefund.adjustmentId,
      refunded_at: refunded ? new Date().toISOString() : null,
      error_code: refunded ? null : "refund_pending_approval",
      refund_attempt_id: null,
      refund_attempted_at: new Date().toISOString(),
    })
    .eq("id", analysisId)
    .eq("refund_attempt_id", attemptId)
    .select("id")
    .maybeSingle();
  if (saveError || !saved) throw new Error("refund_persistence_unconfirmed");

  return providerRefund.adjustmentId;
}
