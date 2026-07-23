import { createHash } from "node:crypto";
import { z } from "zod";
import {
  adjustmentStatus,
  paymentCompletionDecision,
} from "@/lib/analysis/payment-state";
import { purchaseAdjustmentDecision } from "@/lib/analysis/credit-state";
import { serverEnv } from "@/lib/env";
import { getPaddle } from "@/lib/paddle";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const analysisIdSchema = z.string().uuid();
const userIdSchema = z.string().uuid();
const purchaseIdSchema = z.string().uuid();

type TransactionData = {
  id: string;
  customData: Record<string, unknown> | null;
  items: { quantity: number; price: { id: string } | null }[];
};

type AdjustmentData = {
  id: string;
  action: string;
  status: string;
  transactionId: string;
};

async function processCompletedTransaction(data: TransactionData) {
  const env = serverEnv();
  const analysisId = data.customData?.analysis_request_id;
  if (
    typeof analysisId !== "string" ||
    !analysisIdSchema.safeParse(analysisId).success
  ) {
    throw new Error("webhook_missing_analysis_id");
  }
  if (
    data.items.length !== 1 ||
    data.items[0]?.quantity !== 1 ||
    data.items[0]?.price?.id !== env.paddlePriceId
  ) {
    throw new Error("webhook_catalog_mismatch");
  }

  const admin = createAdminClient();
  const { data: analysis, error } = await admin
    .from("analysis_requests")
    .select("id, status, paddle_transaction_id")
    .eq("id", analysisId)
    .single();
  if (error || !analysis) throw new Error("webhook_analysis_not_found");
  const decision = paymentCompletionDecision({
    status: analysis.status,
    storedTransactionId: analysis.paddle_transaction_id,
    incomingTransactionId: data.id,
  });
  if (decision === "noop") {
    return analysis.id;
  }
  if (decision === "reject") {
    throw new Error("webhook_transaction_or_state_mismatch");
  }

  const { data: paid, error: paidError } = await admin
    .from("analysis_requests")
    .update({
      status: "awaiting_name",
      paddle_transaction_id: data.id,
      paid_at: new Date().toISOString(),
      error_code: null,
    })
    .eq("id", analysis.id)
    .in("status", ["payment_pending", "awaiting_payment"])
    .select("id")
    .maybeSingle();
  if (paidError || !paid) throw new Error("webhook_payment_state_conflict");
  return paid.id;
}

async function processCreditPurchase(data: TransactionData) {
  const env = serverEnv();
  const purchaseId = data.customData?.credit_purchase_id;
  const userId = data.customData?.user_id;
  const analysisId = data.customData?.analysis_request_id;
  if (
    typeof purchaseId !== "string" ||
    !purchaseIdSchema.safeParse(purchaseId).success ||
    typeof userId !== "string" ||
    !userIdSchema.safeParse(userId).success ||
    data.customData?.entitlement !== "five_card_credits" ||
    data.customData?.credits !== 5
  ) {
    throw new Error("webhook_invalid_credit_purchase");
  }
  if (
    analysisId !== null &&
    analysisId !== undefined &&
    (typeof analysisId !== "string" ||
      !analysisIdSchema.safeParse(analysisId).success)
  ) {
    throw new Error("webhook_invalid_resume_analysis");
  }
  if (
    data.items.length !== 1 ||
    data.items[0]?.quantity !== 1 ||
    data.items[0]?.price?.id !== env.paddlePriceId
  ) {
    throw new Error("webhook_catalog_mismatch");
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("grant_credit_purchase", {
    p_purchase_id: purchaseId,
    p_user_id: userId,
    p_transaction_id: data.id,
    p_credits: 5,
  });
  if (error) throw new Error("webhook_credit_grant_failed");

  let resumedAnalysisId: string | null = null;
  if (typeof analysisId === "string") {
    const { data: resumed, error: resumeError } = await admin
      .from("analysis_requests")
      .update({ status: "awaiting_name", error_code: null })
      .eq("id", analysisId)
      .eq("user_id", userId)
      .eq("status", "awaiting_payment")
      .select("id")
      .maybeSingle();
    if (resumeError) throw new Error("webhook_resume_analysis_failed");
    resumedAnalysisId = resumed?.id ?? null;
  }

  return { purchaseId, analysisId: resumedAnalysisId };
}

async function processAdjustment(data: AdjustmentData) {
  const admin = createAdminClient();
  const { data: purchase } = await admin
    .from("credit_purchases")
    .select("id, status")
    .eq("paddle_transaction_id", data.transactionId)
    .maybeSingle();

  if (purchase) {
    const purchaseDecision = purchaseAdjustmentDecision({
      action: data.action,
      status: data.status,
    });
    if (purchaseDecision === "disputed") {
      await admin
        .from("credit_purchases")
        .update({
          status: "disputed",
          credits_remaining: 0,
          paddle_adjustment_id: data.id,
        })
        .eq("id", purchase.id);
      return;
    }
    if (purchaseDecision === "refunded") {
      await admin
        .from("credit_purchases")
        .update({
          status: "refunded",
          credits_remaining: 0,
          paddle_adjustment_id: data.id,
          refunded_at: new Date().toISOString(),
        })
        .eq("id", purchase.id);
    } else if (purchaseDecision === "refund_pending") {
      await admin
        .from("credit_purchases")
        .update({
          status: "refund_pending",
          paddle_adjustment_id: data.id,
          refund_requested_at: new Date().toISOString(),
        })
        .eq("id", purchase.id)
        .neq("status", "refunded");
    } else if (purchaseDecision === "refund_failed") {
      await admin
        .from("credit_purchases")
        .update({
          status: "active",
          paddle_adjustment_id: data.id,
        })
        .eq("id", purchase.id)
        .eq("status", "refund_pending");
    }
    return;
  }

  const { data: analysis } = await admin
    .from("analysis_requests")
    .select("id, status")
    .eq("paddle_transaction_id", data.transactionId)
    .maybeSingle();
  if (!analysis) return;

  const nextStatus = adjustmentStatus({
    action: data.action,
    status: data.status,
  });
  if (nextStatus === "disputed") {
    await admin
      .from("analysis_requests")
      .update({
        status: "disputed",
        paddle_adjustment_id: data.id,
        error_code: data.action,
      })
      .eq("id", analysis.id);
    return;
  }

  if (!nextStatus) return;
  if (nextStatus === "refunded") {
    await admin
      .from("analysis_requests")
      .update({
        status: "refunded",
        paddle_adjustment_id: data.id,
        refunded_at: new Date().toISOString(),
        error_code: null,
      })
      .eq("id", analysis.id)
      .neq("status", "completed");
  } else if (nextStatus === "refund_pending") {
    await admin
      .from("analysis_requests")
      .update({
        status: "refund_pending",
        paddle_adjustment_id: data.id,
        error_code: "refund_pending_approval",
      })
      .eq("id", analysis.id)
      .neq("status", "completed");
  } else if (nextStatus === "failed") {
    await admin
      .from("analysis_requests")
      .update({
        status: "failed",
        paddle_adjustment_id: data.id,
        error_code: `refund_${data.status}`,
      })
      .eq("id", analysis.id)
      .neq("status", "completed");
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("paddle-signature");
  if (!signature) {
    return Response.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = await getPaddle().webhooks.unmarshal(
      rawBody,
      serverEnv().paddleWebhookSecret,
      signature,
    );
  } catch {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  const admin = createAdminClient();
  const digest = createHash("sha256").update(rawBody).digest("hex");
  const { error: insertError } = await admin.from("payment_events").insert({
    event_id: event.eventId,
    event_type: event.eventType,
    transaction_id:
      "id" in event.data && event.eventType.startsWith("transaction.")
        ? String(event.data.id)
        : "transactionId" in event.data
          ? String(event.data.transactionId)
          : null,
    occurred_at: event.occurredAt,
    payload_digest: digest,
  });

  if (insertError?.code === "23505") {
    return Response.json({ received: true, duplicate: true });
  }
  if (insertError) {
    return Response.json({ error: "Webhook storage unavailable." }, { status: 503 });
  }

  try {
    if (event.eventType === "transaction.completed") {
      const transaction = event.data as TransactionData;
      const isCreditPurchase =
        transaction.customData?.entitlement === "five_card_credits";
      const processed = isCreditPurchase
        ? await processCreditPurchase(transaction)
        : {
            purchaseId: null,
            analysisId: await processCompletedTransaction(transaction),
          };
      await admin
        .from("payment_events")
        .update({
          analysis_request_id: processed.analysisId,
          credit_purchase_id: processed.purchaseId,
        })
        .eq("event_id", event.eventId);
    } else if (
      event.eventType === "adjustment.created" ||
      event.eventType === "adjustment.updated"
    ) {
      await processAdjustment(event.data as AdjustmentData);
    }
    return Response.json({ received: true });
  } catch {
    await admin.from("payment_events").delete().eq("event_id", event.eventId);
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}

