import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const customDataSchema = z.object({
  user_id: z.string().uuid(),
  credit_purchase_id: z.string().uuid(),
  analysis_request_id: z.string().uuid().optional(),
  entitlement: z.literal("five_card_credits"),
  credits: z.union([z.literal(5), z.literal("5")]),
});

const webhookSchema = z.object({
  meta: z.object({
    event_name: z.enum(["order_created", "order_refunded"]),
    custom_data: customDataSchema,
  }),
  data: z.object({
    type: z.literal("orders"),
    id: z.string().min(1),
    attributes: z.object({
      store_id: z.number().int().positive(),
      status: z.string(),
      refunded: z.boolean(),
      refunded_amount: z.number().int().nonnegative(),
      test_mode: z.boolean(),
      created_at: z.string().datetime(),
      updated_at: z.string().datetime(),
      first_order_item: z.object({
        variant_id: z.number().int().positive(),
      }),
    }),
  }),
});

export type LemonSqueezyWebhook = z.infer<typeof webhookSchema>;

export function verifyLemonSqueezySignature(
  rawBody: string,
  signature: string,
  secret: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function parseLemonSqueezyWebhook(
  rawBody: string,
  expected: { storeId: number; variantId: number; testMode: boolean },
) {
  const event = webhookSchema.parse(JSON.parse(rawBody));
  const attributes = event.data.attributes;
  if (
    attributes.store_id !== expected.storeId ||
    attributes.first_order_item.variant_id !== expected.variantId ||
    attributes.test_mode !== expected.testMode
  ) {
    throw new Error("webhook_catalog_mismatch");
  }
  if (event.meta.event_name === "order_created" && attributes.status !== "paid") {
    throw new Error("webhook_order_not_paid");
  }
  return event;
}

export function lemonSqueezyEventId(event: LemonSqueezyWebhook) {
  const suffix =
    event.meta.event_name === "order_refunded"
      ? `:${event.data.attributes.refunded_amount}`
      : "";
  return `lemon_squeezy:${event.meta.event_name}:${event.data.id}${suffix}`;
}
