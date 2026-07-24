import "server-only";

import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { googlePlayEnv } from "@/lib/env";
import {
  type GooglePlayMoney,
  type GooglePlayProductPurchase,
  googlePlayMoneyToCents,
  validateGooglePlayPurchase as validatePurchaseData,
} from "@/lib/payments/google-play-validation";

export { googlePlayMoneyToCents };

const ANDROID_PUBLISHER_SCOPE =
  "https://www.googleapis.com/auth/androidpublisher";
const API_ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3";

type GooglePlayOrder = {
  orderId?: string;
  purchaseToken?: string;
  state?: string;
  total?: GooglePlayMoney;
  lineItems?: Array<{ productId?: string }>;
};

function encode(value: string) {
  return encodeURIComponent(value);
}

async function getClient() {
  const env = googlePlayEnv();
  const auth = new GoogleAuth({
    credentials: env.credentials,
    scopes: [ANDROID_PUBLISHER_SCOPE],
  });
  return auth.getClient();
}

export async function getGooglePlayPurchase(purchaseToken: string) {
  const env = googlePlayEnv();
  const client = await getClient();
  const response = await client.request<GooglePlayProductPurchase>({
    url:
      `${API_ROOT}/applications/${encode(env.packageId)}` +
      `/purchases/productsv2/tokens/${encode(purchaseToken)}`,
  });
  return response.data;
}

export async function getGooglePlayOrder(orderId: string) {
  const env = googlePlayEnv();
  const client = await getClient();
  const response = await client.request<GooglePlayOrder>({
    url:
      `${API_ROOT}/applications/${encode(env.packageId)}` +
      `/orders/${encode(orderId)}`,
  });
  return response.data;
}

export function validateGooglePlayPurchase(
  purchase: GooglePlayProductPurchase,
) {
  return validatePurchaseData(purchase, googlePlayEnv().productId);
}

export async function consumeGooglePlayPurchase(
  productId: string,
  purchaseToken: string,
) {
  const env = googlePlayEnv();
  if (productId !== env.productId) {
    throw new Error("google_play_product_mismatch");
  }
  const client = await getClient();
  await client.request({
    method: "POST",
    url:
      `${API_ROOT}/applications/${encode(env.packageId)}` +
      `/purchases/products/${encode(productId)}` +
      `/tokens/${encode(purchaseToken)}:consume`,
  });
}

export async function refundGooglePlayOrder(orderId: string) {
  const env = googlePlayEnv();
  const client = await getClient();
  await client.request({
    method: "POST",
    url:
      `${API_ROOT}/applications/${encode(env.packageId)}` +
      `/orders/${encode(orderId)}:refund`,
    data: { revoke: true },
  });
  return { orderId };
}

export async function verifyGooglePlayPubSubToken(
  authorization: string | null,
) {
  const env = googlePlayEnv();
  if (!env.pubSubAudience || !env.pubSubServiceAccount) {
    throw new Error("google_play_pubsub_not_configured");
  }
  const match = authorization?.match(/^Bearer (.+)$/i);
  if (!match) throw new Error("google_play_pubsub_missing_token");
  const ticket = await new OAuth2Client().verifyIdToken({
    idToken: match[1],
    audience: env.pubSubAudience,
  });
  const payload = ticket.getPayload();
  if (
    payload?.email !== env.pubSubServiceAccount ||
    payload.email_verified !== true
  ) {
    throw new Error("google_play_pubsub_invalid_token");
  }
  return payload;
}
