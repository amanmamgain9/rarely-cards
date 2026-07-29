import "server-only";

import { randomUUID } from "node:crypto";
import { getPaddle } from "@/lib/paddle";
import {
  getGooglePlayOrder,
  refundGooglePlayOrder,
} from "@/lib/payments/google-play";
import { createAdminClient } from "@/lib/supabase/admin";

type ProviderRefund = {
  adjustmentId: string;
  status: "pending" | "refunded" | "rejected" | "reversed";
  occurredAt: string;
};

async function findPaddleRefund(
  transactionId: string,
  adjustmentId?: string,
): Promise<ProviderRefund | null> {
  const adjustments = getPaddle().adjustments.list({
    action: "refund",
    transactionId: [transactionId],
    perPage: 50,
  });
  for await (const adjustment of adjustments) {
    if (adjustmentId && adjustment.id !== adjustmentId) continue;
    if (
      ["approved", "pending_approval", "rejected", "reversed"].includes(
        adjustment.status,
      )
    ) {
      if (
        !adjustmentId &&
        (adjustment.status === "rejected" || adjustment.status === "reversed")
      ) {
        continue;
      }
      return {
        adjustmentId: adjustment.id,
        status:
          adjustment.status === "approved"
            ? "refunded"
            : adjustment.status === "rejected"
              ? "rejected"
              : adjustment.status === "reversed"
                ? "reversed"
                : "pending",
        occurredAt: adjustment.updatedAt,
      };
    }
  }
  return null;
}

async function findGooglePlayRefund(
  orderId: string,
): Promise<ProviderRefund | null> {
  const order = await getGooglePlayOrder(orderId);
  if (order.state !== "PENDING_REFUND" && order.state !== "REFUNDED") {
    return null;
  }
  return {
    adjustmentId: `google-play-refund:${orderId}`,
    status: order.state === "REFUNDED" ? "refunded" : "pending",
    occurredAt: new Date().toISOString(),
  };
}

export async function startCreditPurchaseRefund(
  purchaseId: string,
  userId: string,
  reason = "Rarely 14-day money-back guarantee",
) {
  const admin = createAdminClient();
  const { data: purchase, error } = await admin
    .from("credit_purchases")
    .select(
      "id, user_id, status, completed_at, payment_provider, provider_transaction_id, provider_adjustment_id, refund_requested_at",
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
    if (
      purchase.payment_provider === "paddle" &&
      purchase.provider_adjustment_id
    ) {
      const reconciled = await findPaddleRefund(
        purchase.provider_transaction_id,
        purchase.provider_adjustment_id,
      ).catch(() => null);
      if (reconciled?.status === "reversed") {
        const { error: reversalError } = await admin.rpc(
          "apply_credit_purchase_adjustment",
          {
            p_purchase_id: purchase.id,
            p_decision: "refund_reversed",
            p_adjustment_id: reconciled.adjustmentId,
            p_occurred_at: reconciled.occurredAt,
          },
        );
        if (reversalError) throw new Error("refund_persistence_unconfirmed");
        throw new Error("refund_reversed");
      }
    }
    if (purchase.payment_provider === "google_play") {
      const now = new Date().toISOString();
      const { error: playStateError } = await admin
        .from("google_play_purchases")
        .update({
          purchase_state: "voided",
          voided_at: now,
          last_verified_at: now,
        })
        .eq("order_id", purchase.provider_transaction_id);
      if (playStateError) throw new Error("refund_persistence_unconfirmed");
    }
    return {
      provider: purchase.payment_provider,
      adjustmentId: purchase.provider_adjustment_id,
      status: "refunded" as const,
    };
  }
  if (purchase.status === "refund_pending" && purchase.provider_adjustment_id) {
    const reconciled =
      purchase.payment_provider === "google_play"
        ? await findGooglePlayRefund(purchase.provider_transaction_id).catch(
            () => null,
          )
        : purchase.payment_provider === "paddle"
          ? await findPaddleRefund(
              purchase.provider_transaction_id,
              purchase.provider_adjustment_id,
            ).catch(() => null)
          : null;
    if (
      (reconciled?.status === "rejected" ||
        reconciled?.status === "reversed") &&
      purchase.payment_provider === "paddle"
    ) {
      const { error: rejectionError } = await admin.rpc(
        "apply_credit_purchase_adjustment",
        {
          p_purchase_id: purchase.id,
          p_decision:
            reconciled.status === "reversed"
              ? "refund_reversed"
              : "refund_rejected",
          p_adjustment_id: reconciled.adjustmentId,
          p_occurred_at: reconciled.occurredAt,
        },
      );
      if (rejectionError) {
        throw new Error("refund_persistence_unconfirmed");
      }
      throw new Error(
        reconciled.status === "reversed"
          ? "refund_reversed"
          : "refund_rejected",
      );
    }
    if (reconciled?.status === "refunded") {
      const { error: revokeError } = await admin.rpc("revoke_credit_purchase", {
        p_purchase_id: purchase.id,
        p_status: "refunded",
        p_adjustment_id: reconciled.adjustmentId,
        p_refunded_at: new Date().toISOString(),
      });
      if (revokeError) throw new Error("refund_persistence_unconfirmed");
      if (purchase.payment_provider === "google_play") {
        const now = new Date().toISOString();
        const { error: playStateError } = await admin
          .from("google_play_purchases")
          .update({
            purchase_state: "voided",
            voided_at: now,
            last_verified_at: now,
          })
          .eq("order_id", purchase.provider_transaction_id);
        if (playStateError) throw new Error("refund_persistence_unconfirmed");
      }
      return {
        provider: purchase.payment_provider,
        adjustmentId: reconciled.adjustmentId,
        status: "refunded" as const,
      };
    }
    return {
      provider: purchase.payment_provider,
      adjustmentId: purchase.provider_adjustment_id,
      status: "refund_pending" as const,
    };
  }
  if (!["active", "refund_pending"].includes(purchase.status)) {
    throw new Error("refund_not_allowed");
  }
  if (
    purchase.payment_provider !== "paddle" &&
    purchase.payment_provider !== "google_play"
  ) {
    // Historical providers remain readable, but must never be moved into a
    // pending state when this deployment cannot contact that provider.
    throw new Error("refund_provider_not_supported");
  }

  const attemptId = randomUUID();
  const attemptedAt = new Date().toISOString();
  let claimed = null;
  if (purchase.status === "active") {
    const { data: frozen } = await admin
      .from("credit_purchases")
      .update({
        status: "refund_pending",
        refund_requested_at: attemptedAt,
        refund_attempt_id: attemptId,
        refund_attempted_at: attemptedAt,
      })
      .eq("id", purchase.id)
      .eq("status", "active")
      .is("refund_attempt_id", null)
      .select("id")
      .maybeSingle();
    claimed = frozen;
  } else {
    const { data: availableClaim } = await admin
      .from("credit_purchases")
      .update({
        refund_attempt_id: attemptId,
        refund_attempted_at: attemptedAt,
      })
      .eq("id", purchase.id)
      .eq("status", "refund_pending")
      .is("provider_adjustment_id", null)
      .is("refund_attempt_id", null)
      .select("id")
      .maybeSingle();
    claimed = availableClaim;
    if (!claimed) {
      const staleCutoff = new Date(Date.now() - 10 * 60_000).toISOString();
      const { data: staleClaim } = await admin
        .from("credit_purchases")
        .update({
          refund_attempt_id: attemptId,
          refund_attempted_at: attemptedAt,
        })
        .eq("id", purchase.id)
        .eq("status", "refund_pending")
        .is("provider_adjustment_id", null)
        .lt("refund_attempted_at", staleCutoff)
        .select("id")
        .maybeSingle();
      claimed = staleClaim;
    }
  }
  if (!claimed) throw new Error("refund_retry_later");

  let providerRefund: ProviderRefund | null = null;
  try {
    if (purchase.payment_provider === "google_play") {
      providerRefund = await findGooglePlayRefund(
        purchase.provider_transaction_id,
      );
      if (!providerRefund) {
        const order = await refundGooglePlayOrder(
          purchase.provider_transaction_id,
        );
        providerRefund = {
          adjustmentId: `google-play-refund:${order.orderId}`,
          // The empty success response confirms acceptance, not settlement.
          // RTDN or a later order lookup will move this to refunded.
          status: "pending",
          occurredAt: new Date().toISOString(),
        };
      }
    } else if (purchase.payment_provider === "paddle") {
      providerRefund = await findPaddleRefund(
        purchase.provider_transaction_id,
      );
      if (!providerRefund) {
        const adjustment = await getPaddle().adjustments.create({
          action: "refund",
          type: "full",
          transactionId: purchase.provider_transaction_id,
          reason,
        });
        providerRefund = {
          adjustmentId: adjustment.id,
          status:
            adjustment.status === "approved"
              ? "refunded"
              : adjustment.status === "rejected"
                ? "rejected"
                : "pending",
          occurredAt: adjustment.updatedAt,
        };
      }
    } else {
      throw new Error("refund_provider_not_supported");
    }
  } catch (providerError) {
    // A provider may accept the request even if its response is lost. Check
    // once for a positive refund record, but never treat immediate absence as
    // proof that it is safe to unfreeze credits.
    try {
      providerRefund =
        purchase.payment_provider === "google_play"
          ? await findGooglePlayRefund(purchase.provider_transaction_id)
          : purchase.payment_provider === "paddle"
            ? await findPaddleRefund(purchase.provider_transaction_id)
            : null;
    } catch {
      providerRefund = null;
    }
    if (!providerRefund) {
      // A successful immediate lookup cannot prove that a timed-out provider
      // request was rejected. Keep credits frozen until a later reconciliation.
      throw providerError;
    }
  }

  if (!providerRefund) throw new Error("refund_provider_unconfirmed");
  if (
    providerRefund.status === "rejected" ||
    providerRefund.status === "reversed"
  ) {
    const { data: reactivated, error: rejectionError } = await admin
      .from("credit_purchases")
      .update({
        status: "active",
        provider_adjustment_id: null,
        refund_requested_at: null,
        refund_attempt_id: null,
        refund_attempted_at: null,
      })
      .eq("id", purchase.id)
      .eq("status", "refund_pending")
      .eq("refund_attempt_id", attemptId)
      .select("id")
      .maybeSingle();
    if (rejectionError || !reactivated) {
      throw new Error("refund_persistence_unconfirmed");
    }
    throw new Error(
      providerRefund.status === "reversed"
        ? "refund_reversed"
        : "refund_rejected",
    );
  }
  if (providerRefund.status === "refunded") {
    const { error: revokeError } = await admin.rpc("revoke_credit_purchase", {
      p_purchase_id: purchase.id,
      p_status: "refunded",
      p_adjustment_id: providerRefund.adjustmentId,
      p_refunded_at: new Date().toISOString(),
    });
    if (revokeError) throw new Error("refund_persistence_unconfirmed");
    if (purchase.payment_provider === "google_play") {
      const now = new Date().toISOString();
      const { error: playStateError } = await admin
        .from("google_play_purchases")
        .update({
          purchase_state: "voided",
          voided_at: now,
          last_verified_at: now,
        })
        .eq("order_id", purchase.provider_transaction_id);
      if (playStateError) throw new Error("refund_persistence_unconfirmed");
    }
    return {
      provider: purchase.payment_provider,
      adjustmentId: providerRefund.adjustmentId,
      status: "refunded" as const,
    };
  }

  const { data: saved, error: updateError } = await admin
    .from("credit_purchases")
    .update({
      status: "refund_pending",
      provider_adjustment_id: providerRefund.adjustmentId,
      refunded_at: null,
      refund_attempt_id: null,
      refund_attempted_at: null,
    })
    .eq("id", purchase.id)
    .eq("status", "refund_pending")
    .is("provider_adjustment_id", null)
    .eq("refund_attempt_id", attemptId)
    .select("id")
    .maybeSingle();
  if (updateError || !saved) {
    const { data: current } = await admin
      .from("credit_purchases")
      .select("status, provider_adjustment_id")
      .eq("id", purchase.id)
      .maybeSingle();
    if (current?.provider_adjustment_id) {
      return {
        provider: purchase.payment_provider,
        adjustmentId: current.provider_adjustment_id,
        status:
          current.status === "refunded"
            ? ("refunded" as const)
            : ("refund_pending" as const),
      };
    }
    // The provider accepted the request, but local durability is not yet
    // confirmed. Return an error so the next attempt reconciles provider state.
    throw new Error("refund_persistence_unconfirmed");
  }
  return {
    provider: purchase.payment_provider,
    adjustmentId: providerRefund.adjustmentId,
    status: "refund_pending" as const,
  };
}
