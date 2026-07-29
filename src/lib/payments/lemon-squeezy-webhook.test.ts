import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  lemonSqueezyEventId,
  parseLemonSqueezyWebhook,
  verifyLemonSqueezySignature,
} from "@/lib/payments/lemon-squeezy-webhook";

function payload(eventName: "order_created" | "order_refunded") {
  return {
    meta: {
      event_name: eventName,
      custom_data: {
        user_id: "2a3f5c9d-7524-45a2-b0a6-d9cce050dd01",
        credit_purchase_id: "d591cb97-4ebf-4db3-aebb-e2f574e2e740",
        analysis_request_id: "37ba2b56-2c31-41fe-8178-c6284be18ce8",
        entitlement: "five_card_credits",
        credits: 5,
      },
    },
    data: {
      type: "orders",
      id: "4421",
      attributes: {
        store_id: 12,
        status: "paid",
        refunded: eventName === "order_refunded",
        refunded_amount: eventName === "order_refunded" ? 500 : 0,
        test_mode: true,
        created_at: "2026-07-23T10:00:00.000Z",
        updated_at: "2026-07-23T10:05:00.000Z",
        first_order_item: { variant_id: 34 },
      },
    },
  };
}

describe("legacy Lemon Squeezy webhooks", () => {
  it("verifies HMAC signatures without accepting malformed values", () => {
    const body = JSON.stringify(payload("order_created"));
    const signature = createHmac("sha256", "secret").update(body).digest("hex");
    expect(verifyLemonSqueezySignature(body, signature, "secret")).toBe(true);
    expect(verifyLemonSqueezySignature(body, "not-hex", "secret")).toBe(false);
    expect(verifyLemonSqueezySignature(`${body} `, signature, "secret")).toBe(false);
  });

  it("validates the historical catalog and custom entitlement", () => {
    const event = parseLemonSqueezyWebhook(
      JSON.stringify(payload("order_created")),
      { storeId: 12, variantId: 34, testMode: true },
    );
    expect(event.meta.custom_data.credits).toBe(5);
    expect(() =>
      parseLemonSqueezyWebhook(JSON.stringify(payload("order_created")), {
        storeId: 12,
        variantId: 99,
        testMode: true,
      }),
    ).toThrow("webhook_catalog_mismatch");
  });

  it("creates stable, refund-aware event IDs", () => {
    const created = parseLemonSqueezyWebhook(
      JSON.stringify(payload("order_created")),
      { storeId: 12, variantId: 34, testMode: true },
    );
    const refunded = parseLemonSqueezyWebhook(
      JSON.stringify(payload("order_refunded")),
      { storeId: 12, variantId: 34, testMode: true },
    );
    expect(lemonSqueezyEventId(created)).toBe(
      "lemon_squeezy:order_created:4421",
    );
    expect(lemonSqueezyEventId(refunded)).toBe(
      "lemon_squeezy:order_refunded:4421:500",
    );
  });
});
