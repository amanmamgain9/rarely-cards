import { randomUUID } from "node:crypto";
import { z } from "zod";
import { googlePlayEnv } from "@/lib/env";
import { googlePlayPaymentEventIdentity } from "@/lib/payments/google-play-events";
import { googlePlayCreditKind } from "@/lib/payments/catalog";
import {
  getGooglePlayPurchase,
  verifyGooglePlayPubSubToken,
} from "@/lib/payments/google-play";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const envelopeSchema = z.object({
  message: z.object({
    data: z.string().min(1),
    messageId: z.string().min(1),
    publishTime: z.string().optional(),
  }),
  subscription: z.string().min(1).optional(),
});

const notificationSchema = z.object({
  packageName: z.string(),
  eventTimeMillis: z.string().regex(/^\d+$/).optional(),
  testNotification: z.object({ version: z.string() }).optional(),
  oneTimeProductNotification: z
    .object({
      notificationType: z.number().int(),
      purchaseToken: z.string().min(1),
      sku: z.string().min(1),
    })
    .optional(),
  voidedPurchaseNotification: z
    .object({
      orderId: z.string().min(1),
      productType: z.number().int(),
      refundType: z.number().int(),
    })
    .optional(),
});

async function revokeCreditPurchase(
  purchaseId: string,
  status: "refunded" | "failed",
  adjustmentId: string,
) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("revoke_credit_purchase", {
    p_purchase_id: purchaseId,
    p_status: status,
    p_adjustment_id: adjustmentId,
    p_refunded_at: status === "refunded" ? new Date().toISOString() : null,
  });
  if (error) throw new Error("google_play_credit_revocation_failed");
}

export async function POST(request: Request) {
  try {
    await verifyGooglePlayPubSubToken(request.headers.get("authorization"));
  } catch {
    return Response.json({ error: "Invalid Pub/Sub identity." }, { status: 401 });
  }

  const rawBody = await request.text();
  let envelope;
  try {
    envelope = envelopeSchema.safeParse(JSON.parse(rawBody || "null"));
  } catch {
    return Response.json({ error: "Invalid Pub/Sub message." }, { status: 400 });
  }
  if (!envelope.success) {
    return Response.json({ error: "Invalid Pub/Sub message." }, { status: 400 });
  }

  let notification;
  try {
    notification = notificationSchema.parse(
      JSON.parse(
        Buffer.from(envelope.data.message.data, "base64").toString("utf8"),
      ),
    );
  } catch {
    return Response.json({ error: "Invalid Play notification." }, { status: 400 });
  }

  const env = googlePlayEnv();
  if (notification.packageName !== env.packageId) {
    return Response.json({ error: "Package mismatch." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { eventId, digest } = googlePlayPaymentEventIdentity({
    messageId: envelope.data.message.messageId,
    data: envelope.data.message.data,
    subscription: envelope.data.subscription,
  });
  const eventType = notification.testNotification
    ? "test"
    : notification.oneTimeProductNotification
      ? `one_time:${notification.oneTimeProductNotification.notificationType}`
      : notification.voidedPurchaseNotification
        ? "voided"
        : "unknown";
  const transactionId =
    notification.voidedPurchaseNotification?.orderId ??
    notification.oneTimeProductNotification?.purchaseToken ??
    null;
  const { error: eventError } = await admin.from("payment_events").insert({
    event_id: eventId,
    event_type: eventType,
    payment_provider: "google_play",
    transaction_id: transactionId,
    occurred_at: notification.eventTimeMillis
      ? new Date(Number(notification.eventTimeMillis)).toISOString()
      : envelope.data.message.publishTime ?? null,
    payload_digest: digest,
    processed_at: null,
  });
  if (eventError && eventError.code !== "23505") {
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
    return Response.json({ error: "Webhook event is already processing." }, { status: 503 });
  }

  try {
    const oneTime = notification.oneTimeProductNotification;
    if (
      oneTime &&
      googlePlayCreditKind(
        oneTime.sku,
        env.productId,
        env.legacyCardProductIds,
      )
    ) {
      const { data: stored, error: lookupError } = await admin
        .from("google_play_purchases")
        .select("credit_purchase_id")
        .eq("purchase_token", oneTime.purchaseToken)
        .maybeSingle();
      if (lookupError) throw new Error("google_play_purchase_lookup_failed");
      if (stored) {
        const current =
          oneTime.notificationType === 2
            ? null
            : await getGooglePlayPurchase(oneTime.purchaseToken);
        const canceled =
          oneTime.notificationType === 2 ||
          current?.purchaseStateContext?.purchaseState === "CANCELLED";
        if (canceled) {
          const { error } = await admin
            .from("google_play_purchases")
            .update({
              purchase_state: "canceled",
              last_verified_at: new Date().toISOString(),
            })
            .eq("purchase_token", oneTime.purchaseToken);
          if (error) throw new Error("google_play_cancellation_update_failed");
          await revokeCreditPurchase(
            stored.credit_purchase_id,
            "failed",
            `google-play-canceled:${eventId}`,
          );
        } else {
          const { error } = await admin
            .from("google_play_purchases")
            .update({ last_verified_at: new Date().toISOString() })
            .eq("purchase_token", oneTime.purchaseToken);
          if (error) throw new Error("google_play_verification_update_failed");
        }
        const { error: linkError } = await admin
          .from("payment_events")
          .update({ credit_purchase_id: stored.credit_purchase_id })
          .eq("event_id", eventId);
        if (linkError) throw new Error("google_play_event_link_failed");
      }
    }

    const voided = notification.voidedPurchaseNotification;
    if (voided && voided.productType === 2) {
      const { data: stored, error: lookupError } = await admin
        .from("google_play_purchases")
        .select("credit_purchase_id")
        .eq("order_id", voided.orderId)
        .maybeSingle();
      if (lookupError) throw new Error("google_play_order_lookup_failed");
      if (stored) {
        const { error } = await admin
          .from("google_play_purchases")
          .update({
            purchase_state: "voided",
            voided_at: new Date().toISOString(),
            last_verified_at: new Date().toISOString(),
          })
          .eq("order_id", voided.orderId);
        if (error) throw new Error("google_play_void_update_failed");
        await revokeCreditPurchase(
          stored.credit_purchase_id,
          "refunded",
          `google-play-voided:${voided.orderId}`,
        );
        const { error: linkError } = await admin
          .from("payment_events")
          .update({ credit_purchase_id: stored.credit_purchase_id })
          .eq("event_id", eventId);
        if (linkError) throw new Error("google_play_event_link_failed");
      }
    }

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
