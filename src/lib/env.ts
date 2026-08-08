import "server-only";

import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_MODEL,
} from "@/lib/ai/gemini-config";
import { seedanceEnv as seedanceProviderEnv } from "@/lib/video-agent/video_models/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredPositiveInteger(name: string): number {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Environment variable must be a positive integer: ${name}`);
  }
  return value;
}

export function hasPublicSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export function publicSupabaseEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function hasPaddleEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_APP_URL?.trim() &&
    process.env.PADDLE_API_KEY?.trim() &&
      process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() &&
      process.env.PADDLE_WEBHOOK_SECRET?.trim() &&
      process.env.PADDLE_PRICE_ID?.trim(),
  );
}

export function paddleEnv() {
  return {
    appUrl: required("NEXT_PUBLIC_APP_URL"),
    paddleEnvironment:
      process.env.PADDLE_ENVIRONMENT === "production"
        ? ("production" as const)
        : ("sandbox" as const),
    paddleApiKey: required("PADDLE_API_KEY"),
    paddleClientToken: required("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN"),
    paddleWebhookSecret: required("PADDLE_WEBHOOK_SECRET"),
    paddlePriceId: required("PADDLE_PRICE_ID"),
    paddleLegacyCardPriceIds: (process.env.PADDLE_LEGACY_CARD_PRICE_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

export function lemonSqueezyWebhookEnv() {
  return {
    storeId: requiredPositiveInteger("LEMON_SQUEEZY_STORE_ID"),
    variantId: requiredPositiveInteger("LEMON_SQUEEZY_VARIANT_ID"),
    webhookSecret: required("LEMON_SQUEEZY_WEBHOOK_SECRET"),
    testMode: process.env.LEMON_SQUEEZY_TEST_MODE !== "false",
  };
}

export function hasGooglePlayApiEnv(): boolean {
  return Boolean(
    process.env.GOOGLE_PLAY_PACKAGE_ID?.trim() &&
      process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID?.trim() &&
      process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim(),
  );
}

export function hasGooglePlayRtdnEnv(): boolean {
  return Boolean(
    process.env.GOOGLE_PLAY_PUBSUB_AUDIENCE?.trim() &&
      process.env.GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT?.trim(),
  );
}

export function hasGooglePlayEnv(): boolean {
  return (
    process.env.GOOGLE_PLAY_CHECKOUT_ENABLED === "true" &&
    hasGooglePlayApiEnv() &&
    hasGooglePlayRtdnEnv()
  );
}

export function hasSeedanceEnv(): boolean {
  return Boolean(
    process.env.BYTEPLUS_ARK_API_KEY?.trim() &&
      process.env.BYTEPLUS_WEBHOOK_SECRET?.trim() &&
      process.env.NEXT_PUBLIC_APP_URL?.trim(),
  );
}

export function seedanceEnv() {
  return seedanceProviderEnv();
}

export function googlePlayEnv() {
  const rawCredentials = required("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  let credentials: { client_email: string; private_key: string };
  try {
    const decoded = rawCredentials.startsWith("{")
      ? rawCredentials
      : Buffer.from(rawCredentials, "base64").toString("utf8");
    credentials = JSON.parse(decoded) as {
      client_email: string;
      private_key: string;
    };
  } catch {
    throw new Error("Invalid GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  }
  if (!credentials.client_email?.trim() || !credentials.private_key?.trim()) {
    throw new Error("Invalid GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  }
  return {
    packageId: required("GOOGLE_PLAY_PACKAGE_ID"),
    productId: required("NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID"),
    legacyCardProductIds: (process.env.GOOGLE_PLAY_LEGACY_CARD_PRODUCT_IDS || "five_card_credits")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    credentials,
    pubSubAudience: process.env.GOOGLE_PLAY_PUBSUB_AUDIENCE?.trim() || null,
    pubSubServiceAccount:
      process.env.GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT?.trim() || null,
  };
}

export function geminiEnv() {
  return {
    geminiApiKey: required("GEMINI_API_KEY"),
    geminiModel: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    geminiImageModel:
      process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL,
  };
}
