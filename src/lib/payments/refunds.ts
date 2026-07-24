import "server-only";

import { refundLemonSqueezyOrder } from "@/lib/lemon-squeezy";
import { getPaddle } from "@/lib/paddle";
import { refundGooglePlayOrder } from "@/lib/payments/google-play";
import { createAdminClient } from "@/lib/supabase/admin";

export async function startCreditPurchaseRefund(
  purchaseId: string,
  userId: string,
  reason = "Rarely 14-day money-back guarantee",
) {
  const admin = createAdminClient();
  const { data: purchase, error } = await admin
    .from("credit_purchases")
    .select(
      "id, user_id, status, completed_at, payment_provider, provider_transaction_id, provider_adjustment_id",
    )
    .eq("id", purchaseId)
    .eq("user_id", userId)
    .single();

  if (error || !purchase?.provider_transaction_id || !purchase.completed_at) {
    throw new Error("refund_purchase_not_found");
  }
  if (
    Date.now() - new Date(purchase.completed_at).getTime() >
    14 * 24 * 60 * 60 * 1000
  ) {
    throw new Error("refund_window_closed");
  }
  if (purchase.status === "refunded") {
    return {
      provider: purchase.payment_provider,
      adjustmentId: purchase.provider_adjustment_id,
      status: "refunded" as const,
    };
  }
  if (purchase.status === "refund_pending") {
    return {
      provider: purchase.payment_provider,
      adjustmentId: purchase.provider_adjustment_id,
      status: "refund_pending" as const,
    };
  }
  if (purchase.status !== "active") throw new Error("refund_not_allowed");

  const { data: frozen } = await admin
    .from("credit_purchases")
    .update({
      status: "refund_pending",
      refund_requested_at: new Date().toISOString(),
    })
    .eq("id", purchase.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (!frozen) throw new Error("refund_state_conflict");

  let adjustmentId: string;
  let refunded: boolean;
  if (purchase.payment_provider === "lemon_squeezy") {
    const order = await refundLemonSqueezyOrder(
      purchase.provider_transaction_id,
    );
    adjustmentId = `refund:${order.id}`;
    refunded = order.refunded;
  } else if (purchase.payment_provider === "google_play") {
    const order = await refundGooglePlayOrder(
      purchase.provider_transaction_id,
    );
    adjustmentId = `google-play-refund:${order.orderId}`;
    refunded = true;
  } else {
    const adjustment = await getPaddle().adjustments.create({
      action: "refund",
      type: "full",
      transactionId: purchase.provider_transaction_id,
      reason,
    });
    adjustmentId = adjustment.id;
    refunded = adjustment.status === "approved";
  }

  await admin
    .from("credit_purchases")
    .update({
      status: refunded ? "refunded" : "refund_pending",
      ...(refunded ? { credits_remaining: 0 } : {}),
      provider_adjustment_id: adjustmentId,
      refunded_at: refunded ? new Date().toISOString() : null,
    })
    .eq("id", purchase.id);
  return {
    provider: purchase.payment_provider,
    adjustmentId,
    status: refunded ? ("refunded" as const) : ("refund_pending" as const),
  };
}
