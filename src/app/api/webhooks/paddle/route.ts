import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  adjustmentStatus,
  paymentCompletionDecision,
} from "@/lib/analysis/payment-state";
import { purchaseAdjustmentDecision } from "@/lib/analysis/credit-state";
import { paddleEnv } from "@/lib/env";
import { getPaddle } from "@/lib/payments/paddle";
import { grantCreditPurchase } from "@/lib/payments/credit-purchases";
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
  const env = paddleEnv();
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
    !data.items[0]?.price?.id ||
    ![env.paddlePriceId, ...env.paddleLegacyCardPriceIds].includes(
      data.items[0].price.id,
    )
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
  const env = paddleEnv();
  const purchaseId = data.customData?.credit_purchase_id;
  const userId = data.customData?.user_id;
  const analysisId = data.customData?.analysis_request_id;
  if (
    typeof purchaseId !== "string" ||
    !purchaseIdSchema.safeParse(purchaseId).success ||
    typeof userId !== "string" ||
    !userIdSchema.safeParse(userId).success ||
    !["five_card_credits", "three_talking_pet_videos"].includes(
      String(data.customData?.entitlement),
    ) ||
    ![3, 5].includes(Number(data.customData?.credits))
  ) {
    throw new Error("webhook_invalid_credit_purchase");
  }
  const isVideoPack = data.customData?.entitlement === "three_talking_pet_videos";
  const expectedCredits = isVideoPack ? 3 : 5;
  const acceptedPriceIds = isVideoPack
    ? [env.paddlePriceId]
    : env.paddleLegacyCardPriceIds;
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
    !data.items[0]?.price?.id ||
    !acceptedPriceIds.includes(data.items[0].price.id)
  ) {
    throw new Error("webhook_catalog_mismatch");
  }

  return grantCreditPurchase({
    provider: "paddle",
    purchaseId,
    userId,
    transactionId: data.id,
    analysisId: typeof analysisId === "string" ? analysisId : undefined,
    credits: expectedCredits,
  });
}

async function processAdjustment(data: AdjustmentData, occurredAt: string) {
  const admin = createAdminClient();
  const { data: purchase, error: purchaseError } = await admin
    .from("credit_purchases")
    .select("id")
    .eq("payment_provider", "paddle")
    .eq("provider_transaction_id", data.transactionId)
    .maybeSingle();
  if (purchaseError) throw new Error("webhook_purchase_lookup_failed");

  if (purchase) {
    const purchaseDecision = purchaseAdjustmentDecision({
      action: data.action,
      status: data.status,
    });
    if (purchaseDecision) {
      const { error } = await admin.rpc("apply_credit_purchase_adjustment", {
        p_purchase_id: purchase.id,
        p_decision: purchaseDecision,
        p_adjustment_id: data.id,
        p_occurred_at: occurredAt,
      });
      if (error) throw new Error("webhook_purchase_adjustment_failed");
    }
    return;
  }

  const { data: analysis, error: analysisError } = await admin
    .from("analysis_requests")
    .select("id")
    .eq("paddle_transaction_id", data.transactionId)
    .maybeSingle();
  if (analysisError) throw new Error("webhook_analysis_lookup_failed");
  if (!analysis) return;

  const disputeReversed =
    ["chargeback_reverse", "chargeback_warning_reverse"].includes(data.action) ||
    (["chargeback", "chargeback_warning"].includes(data.action) &&
      data.status === "reversed");
  const nextStatus = adjustmentStatus({
    action: data.action,
    status: data.status,
  });
  if (!nextStatus && !disputeReversed) return;
  const legacyDecision =
    disputeReversed
      ? "dispute_reversed"
      : nextStatus === "disputed" ||
    nextStatus === "refunded" ||
    nextStatus === "refund_pending"
      ? nextStatus
      : "refund_retry";
  const { error } = await admin.rpc("apply_legacy_analysis_adjustment", {
    p_analysis_id: analysis.id,
    p_decision: legacyDecision,
    p_adjustment_id: data.id,
    p_occurred_at: occurredAt,
    p_error_code:
      nextStatus === "disputed" ? data.action : `refund_${data.status}`,
  });
  if (error) throw new Error("webhook_analysis_adjustment_failed");
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
      paddleEnv().paddleWebhookSecret,
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
    payment_provider: "paddle",
    transaction_id:
      "id" in event.data && event.eventType.startsWith("transaction.")
        ? String(event.data.id)
        : "transactionId" in event.data
          ? String(event.data.transactionId)
          : null,
    occurred_at: event.occurredAt,
    payload_digest: digest,
    processed_at: null,
  });

  if (insertError && insertError.code !== "23505") {
    return Response.json({ error: "Webhook storage unavailable." }, { status: 503 });
  }

  const processingToken = randomUUID();
  const { data: claim, error: claimError } = await admin.rpc(
    "claim_payment_event",
    {
      p_event_id: event.eventId,
      p_payload_digest: digest,
      p_processing_token: processingToken,
    },
  );
  if (claimError || claim === "missing") {
    return Response.json({ error: "Webhook storage unavailable." }, { status: 503 });
  }
  if (claim === "mismatch") {
    return Response.json({ error: "Webhook event mismatch." }, { status: 409 });
  }
  if (claim === "processed") {
    return Response.json({ received: true, duplicate: true });
  }
  if (claim === "busy") {
    return Response.json({ error: "Webhook event is already processing." }, { status: 503 });
  }

  try {
    if (event.eventType === "transaction.completed") {
      const transaction = event.data as TransactionData;
      const isCreditPurchase =
        transaction.customData?.entitlement === "five_card_credits" ||
        transaction.customData?.entitlement === "three_talking_pet_videos";
      const processed = isCreditPurchase
        ? await processCreditPurchase(transaction)
        : {
            purchaseId: null,
            analysisId: await processCompletedTransaction(transaction),
          };
      const { error: linkError } = await admin
        .from("payment_events")
        .update({
          analysis_request_id: processed.analysisId,
          credit_purchase_id: processed.purchaseId,
        })
        .eq("event_id", event.eventId);
      if (linkError) throw new Error("webhook_event_link_failed");
    } else if (
      event.eventType === "adjustment.created" ||
      event.eventType === "adjustment.updated"
    ) {
      await processAdjustment(
        event.data as AdjustmentData,
        event.occurredAt,
      );
    }
    const { data: completed, error: processedError } = await admin
      .from("payment_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_started_at: null,
        processing_token: null,
      })
      .eq("event_id", event.eventId)
      .eq("processing_token", processingToken)
      .select("event_id")
      .maybeSingle();
    if (processedError || !completed) {
      throw new Error("webhook_completion_not_saved");
    }
    return Response.json({ received: true });
  } catch {
    await admin
      .from("payment_events")
      .update({
        processing_started_at: null,
        processing_token: null,
      })
      .eq("event_id", event.eventId)
      .eq("processing_token", processingToken);
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
