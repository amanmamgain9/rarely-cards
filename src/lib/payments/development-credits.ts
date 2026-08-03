import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const DEVELOPMENT_TRANSACTION_PREFIX = "rarely-dev:";
export const DEVELOPMENT_VIDEO_CREDIT_BALANCE = 3;

export function isDevelopmentBillingBypassed() {
  return process.env.NODE_ENV === "development";
}

export function isDevelopmentCreditPurchase(transactionId: string | null) {
  return transactionId?.startsWith(DEVELOPMENT_TRANSACTION_PREFIX) ?? false;
}

export function developmentVideoCreditBalance(actualBalance: number) {
  return isDevelopmentBillingBypassed()
    ? DEVELOPMENT_VIDEO_CREDIT_BALANCE
    : actualBalance;
}

export async function ensureDevelopmentVideoCredits(userId: string) {
  if (!isDevelopmentBillingBypassed()) return;

  const admin = createAdminClient();
  const { data: available, error: readError } = await admin
    .from("credit_purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("credit_kind", "talking_video")
    .like("provider_transaction_id", `${DEVELOPMENT_TRANSACTION_PREFIX}%`)
    .gt("credits_remaining", 0)
    .limit(1);

  if (readError) throw new Error("Development credits could not be checked.");
  if (available?.length) return;

  const now = new Date().toISOString();
  const { error: insertError } = await admin.from("credit_purchases").insert({
    user_id: userId,
    payment_provider: "paddle",
    provider_transaction_id: `${DEVELOPMENT_TRANSACTION_PREFIX}${userId}:${crypto.randomUUID()}`,
    status: "active",
    credits_granted: DEVELOPMENT_VIDEO_CREDIT_BALANCE,
    credits_remaining: DEVELOPMENT_VIDEO_CREDIT_BALANCE,
    credit_kind: "talking_video",
    amount_cents: 0,
    currency: "USD",
    completed_at: "2000-01-01T00:00:00.000Z",
    created_at: now,
    updated_at: now,
    pending_checkout_guarded: false,
  });

  if (insertError) throw new Error("Development credits could not be created.");
}
