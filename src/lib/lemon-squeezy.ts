import "server-only";

import { z } from "zod";
import { lemonSqueezyEnv } from "@/lib/env";

const checkoutResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    attributes: z.object({
      url: z.string().url(),
    }),
  }),
});

const orderResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    attributes: z.object({
      refunded: z.boolean(),
    }),
  }),
});

type CheckoutInput = {
  userId: string;
  email: string | null;
  purchaseId: string;
  analysisId?: string;
};

async function lemonSqueezyRequest(path: string, init: RequestInit) {
  const response = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${lemonSqueezyEnv().apiKey}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`lemon_squeezy_api_${response.status}`);
  }
  return response.json();
}

export async function createLemonSqueezyCheckout(input: CheckoutInput) {
  const env = lemonSqueezyEnv();
  const custom: Record<string, string | number> = {
    user_id: input.userId,
    credit_purchase_id: input.purchaseId,
    entitlement: "five_card_credits",
    credits: 5,
  };
  if (input.analysisId) custom.analysis_request_id = input.analysisId;

  const payload = await lemonSqueezyRequest("/checkouts", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          product_options: {
            redirect_url: input.analysisId ? env.appUrl : `${env.appUrl}/account`,
            enabled_variants: [env.variantId],
          },
          checkout_options: {
            embed: true,
            discount: false,
          },
          checkout_data: {
            ...(input.email ? { email: input.email } : {}),
            custom,
          },
          test_mode: env.testMode,
        },
        relationships: {
          store: { data: { type: "stores", id: String(env.storeId) } },
          variant: { data: { type: "variants", id: String(env.variantId) } },
        },
      },
    }),
  });
  const checkout = checkoutResponseSchema.parse(payload).data;
  return { id: checkout.id, url: checkout.attributes.url };
}

export async function getLemonSqueezyCheckout(checkoutId: string) {
  const payload = await lemonSqueezyRequest(
    `/checkouts/${encodeURIComponent(checkoutId)}`,
    { method: "GET" },
  );
  const checkout = checkoutResponseSchema.parse(payload).data;
  return { id: checkout.id, url: checkout.attributes.url };
}

export async function refundLemonSqueezyOrder(orderId: string) {
  const payload = await lemonSqueezyRequest(
    `/orders/${encodeURIComponent(orderId)}/refund`,
    {
      method: "POST",
      body: JSON.stringify({
        data: { type: "orders", id: orderId, attributes: {} },
      }),
    },
  );
  const order = orderResponseSchema.parse(payload).data;
  return { id: order.id, refunded: order.attributes.refunded };
}
