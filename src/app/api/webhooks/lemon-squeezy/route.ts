import { createHash } from "node:crypto";
import { lemonSqueezyEnv } from "@/lib/env";
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
  const env = lemonSqueezyEnv();
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
  });
  if (insertError?.code === "23505") {
    return Response.json({ received: true, duplicate: true });
  }
  if (insertError) {
    return Response.json({ error: "Webhook storage unavailable." }, { status: 503 });
  }

  try {
    if (event.meta.event_name === "order_created") {
      const processed = await grantCreditPurchase({
        provider: "lemon_squeezy",
        purchaseId: custom.credit_purchase_id,
        userId: custom.user_id,
        transactionId: event.data.id,
        analysisId: custom.analysis_request_id,
      });
      await admin
        .from("payment_events")
        .update({
          analysis_request_id: processed.analysisId,
          credit_purchase_id: processed.purchaseId,
        })
        .eq("event_id", eventId);
    } else {
      const adjustmentId = `refund:${event.data.id}:${event.data.attributes.refunded_amount}`;
      const { data: purchase, error } = await admin
        .from("credit_purchases")
        .select("id")
        .eq("id", custom.credit_purchase_id)
        .eq("user_id", custom.user_id)
        .eq("payment_provider", "lemon_squeezy")
        .eq("provider_transaction_id", event.data.id)
        .maybeSingle();
      if (error || !purchase) throw new Error("webhook_purchase_not_found");
      const { error: updateError } = await admin
        .from("credit_purchases")
        .update({
          status: "refunded",
          credits_remaining: 0,
          provider_adjustment_id: adjustmentId,
          refunded_at:
            event.data.attributes.updated_at || new Date().toISOString(),
        })
        .eq("id", purchase.id);
      if (updateError) throw new Error("webhook_refund_update_failed");
      await admin
        .from("payment_events")
        .update({ credit_purchase_id: purchase.id })
        .eq("event_id", eventId);
    }
    return Response.json({ received: true });
  } catch {
    await admin.from("payment_events").delete().eq("event_id", eventId);
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
