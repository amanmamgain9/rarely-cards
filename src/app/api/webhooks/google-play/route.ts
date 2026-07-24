import { createHash } from "node:crypto";
import { z } from "zod";
import { googlePlayEnv } from "@/lib/env";
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
  await admin
    .from("credit_purchases")
    .update({
      status,
      credits_remaining: 0,
      provider_adjustment_id: adjustmentId,
      ...(status === "refunded"
        ? { refunded_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", purchaseId)
    .in("status", ["checkout_pending", "active", "refund_pending"]);
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
  const eventId = `google_play:${envelope.data.message.messageId}`;
  const digest = createHash("sha256").update(rawBody).digest("hex");
  const eventType = notification.testNotification
    ? "test"
    : notification.oneTimeProductNotification
      ? `one_time:${notification.oneTimeProductNotification.notificationType}`
      : notification.voidedPurchaseNotification
        ? "voided"
        : "unknown";
  const transactionId =
    notification.voidedPurchaseNotification?.orderId ?? null;
  const { error: eventError } = await admin.from("payment_events").insert({
    event_id: eventId,
    event_type: eventType,
    payment_provider: "google_play",
    transaction_id: transactionId,
    occurred_at: notification.eventTimeMillis
      ? new Date(Number(notification.eventTimeMillis)).toISOString()
      : envelope.data.message.publishTime ?? null,
    payload_digest: digest,
  });
  if (eventError?.code === "23505") {
    return Response.json({ received: true, duplicate: true });
  }
  if (eventError) {
    return Response.json({ error: "Webhook storage unavailable." }, { status: 503 });
  }

  try {
    const oneTime = notification.oneTimeProductNotification;
    if (oneTime) {
      if (oneTime.sku !== env.productId) {
        throw new Error("google_play_product_mismatch");
      }
      const { data: stored } = await admin
        .from("google_play_purchases")
        .select("credit_purchase_id")
        .eq("purchase_token", oneTime.purchaseToken)
        .maybeSingle();
      if (stored) {
        const current = await getGooglePlayPurchase(oneTime.purchaseToken);
        const state = current.purchaseStateContext?.purchaseState;
        if (state === "CANCELLED") {
          await admin
            .from("google_play_purchases")
            .update({
              purchase_state: "canceled",
              last_verified_at: new Date().toISOString(),
            })
            .eq("purchase_token", oneTime.purchaseToken);
          await revokeCreditPurchase(
            stored.credit_purchase_id,
            "failed",
            `google-play-canceled:${eventId}`,
          );
        } else {
          await admin
            .from("google_play_purchases")
            .update({ last_verified_at: new Date().toISOString() })
            .eq("purchase_token", oneTime.purchaseToken);
        }
        await admin
          .from("payment_events")
          .update({ credit_purchase_id: stored.credit_purchase_id })
          .eq("event_id", eventId);
      }
    }

    const voided = notification.voidedPurchaseNotification;
    if (voided && voided.productType === 2) {
      const { data: stored } = await admin
        .from("google_play_purchases")
        .select("credit_purchase_id")
        .eq("order_id", voided.orderId)
        .maybeSingle();
      if (stored) {
        await admin
          .from("google_play_purchases")
          .update({
            purchase_state: "voided",
            voided_at: new Date().toISOString(),
            last_verified_at: new Date().toISOString(),
          })
          .eq("order_id", voided.orderId);
        await revokeCreditPurchase(
          stored.credit_purchase_id,
          "refunded",
          `google-play-voided:${voided.orderId}`,
        );
        await admin
          .from("payment_events")
          .update({ credit_purchase_id: stored.credit_purchase_id })
          .eq("event_id", eventId);
      }
    }

    return Response.json({ received: true });
  } catch {
    await admin.from("payment_events").delete().eq("event_id", eventId);
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
