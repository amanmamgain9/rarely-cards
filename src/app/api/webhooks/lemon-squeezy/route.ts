import { createHash, randomUUID } from "node:crypto";
import { lemonSqueezyWebhookEnv } from "@/lib/env";
import { grantCreditPurchase } from "@/lib/payments/credit-purchases";
import {
  lemonSqueezyEventId,
  parseLemonSqueezyWebhook,
  verifyLemonSqueezySignature,
} from "@/lib/payments/lemon-squeezy-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature");
  if (!signature) {
    return Response.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let env;
  try {
    env = lemonSqueezyWebhookEnv();
  } catch {
    return Response.json(
      { error: "Historical webhook is not configured." },
      { status: 503 },
    );
  }
  if (!verifyLemonSqueezySignature(rawBody, signature, env.webhookSecret)) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event;
  try {
    event = parseLemonSqueezyWebhook(rawBody, {
      storeId: env.storeId,
      variantId: env.variantId,
      testMode: env.testMode,
    });
  } catch {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const eventId = lemonSqueezyEventId(event);
  const custom = event.meta.custom_data;
  const admin = createAdminClient();
  const digest = createHash("sha256").update(rawBody).digest("hex");
  const { error: insertError } = await admin.from("payment_events").insert({
    event_id: eventId,
    event_type: event.meta.event_name,
    payment_provider: "lemon_squeezy",
    transaction_id: event.data.id,
    occurred_at:
      event.meta.event_name === "order_created"
        ? event.data.attributes.created_at
        : event.data.attributes.updated_at,
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
      p_event_id: eventId,
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
    return Response.json(
      { error: "Webhook event is already processing." },
      { status: 503 },
    );
  }

  try {
    let purchaseId: string;
    let analysisId: string | null = null;
    if (event.meta.event_name === "order_created") {
      const processed = await grantCreditPurchase({
        provider: "lemon_squeezy",
        purchaseId: custom.credit_purchase_id,
        userId: custom.user_id,
        transactionId: event.data.id,
        analysisId: custom.analysis_request_id,
        credits: 5,
      });
      purchaseId = processed.purchaseId;
      analysisId = processed.analysisId;
    } else {
      const adjustmentId =
        `refund:${event.data.id}:${event.data.attributes.refunded_amount}`;
      const { data: purchase, error } = await admin
        .from("credit_purchases")
        .select("id")
        .eq("id", custom.credit_purchase_id)
        .eq("user_id", custom.user_id)
        .eq("payment_provider", "lemon_squeezy")
        .eq("provider_transaction_id", event.data.id)
        .maybeSingle();
      if (error || !purchase) throw new Error("webhook_purchase_not_found");
      const { error: revokeError } = await admin.rpc("revoke_credit_purchase", {
        p_purchase_id: purchase.id,
        p_status: "refunded",
        p_adjustment_id: adjustmentId,
        p_refunded_at:
          event.data.attributes.updated_at || new Date().toISOString(),
      });
      if (revokeError) throw new Error("webhook_refund_update_failed");
      purchaseId = purchase.id;
    }

    const { error: linkError } = await admin
      .from("payment_events")
      .update({
        analysis_request_id: analysisId,
        credit_purchase_id: purchaseId,
      })
      .eq("event_id", eventId);
    if (linkError) throw new Error("webhook_event_link_failed");

    const { data: completed, error: processedError } = await admin
      .from("payment_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_started_at: null,
        processing_token: null,
      })
      .eq("event_id", eventId)
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
      .eq("event_id", eventId)
      .eq("processing_token", processingToken);
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
