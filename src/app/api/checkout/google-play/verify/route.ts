import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { googlePlayEnv } from "@/lib/env";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { grantCreditPurchase } from "@/lib/payments/credit-purchases";
import {
  consumeGooglePlayPurchase,
  getGooglePlayOrder,
  getGooglePlayPurchase,
  googlePlayMoneyToCents,
  validateGooglePlayPurchase,
} from "@/lib/payments/google-play";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const verifySchema = z.object({
  purchaseToken: z.string().min(20).max(4096),
  productId: z.string().min(1).max(200),
  purchaseId: z.string().uuid().optional(),
  analysisId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const limit = await checkRateLimit({
    request,
    scope: "google-play-verify",
    userId: user.id,
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const body = verifySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid Google Play purchase." }, { status: 400 });
  }
  const env = googlePlayEnv();
  if (body.data.productId !== env.productId) {
    return Response.json({ error: "Unknown Google Play product." }, { status: 400 });
  }

  try {
    const purchase = await getGooglePlayPurchase(body.data.purchaseToken);
    const verified = validateGooglePlayPurchase(purchase);
    const order = await getGooglePlayOrder(verified.orderId);
    if (
      order.orderId !== verified.orderId ||
      order.purchaseToken !== body.data.purchaseToken ||
      order.state !== "PROCESSED"
    ) {
      throw new Error("google_play_order_invalid");
    }

    const admin = createAdminClient();
    const { data: knownToken } = await admin
      .from("google_play_purchases")
      .select("credit_purchase_id, user_id")
      .eq("purchase_token", body.data.purchaseToken)
      .maybeSingle();
    if (knownToken && knownToken.user_id !== user.id) {
      return Response.json(
        { error: "This Google Play purchase belongs to another account." },
        { status: 409 },
      );
    }
    if (
      knownToken &&
      body.data.purchaseId &&
      knownToken.credit_purchase_id !== body.data.purchaseId
    ) {
      return Response.json(
        { error: "Google Play purchase was already claimed." },
        { status: 409 },
      );
    }

    let creditPurchaseId = body.data.purchaseId ?? knownToken?.credit_purchase_id;
    let creditPurchase:
      | {
          id: string;
          status: string;
          resume_analysis_id: string | null;
          payment_provider: string;
        }
      | null = null;

    if (creditPurchaseId) {
      const { data } = await admin
        .from("credit_purchases")
        .select("id, status, resume_analysis_id, payment_provider")
        .eq("id", creditPurchaseId)
        .eq("user_id", user.id)
        .maybeSingle();
      creditPurchase = data;
    } else {
      let pendingQuery = admin
        .from("credit_purchases")
        .select("id, status, resume_analysis_id, payment_provider")
        .eq("user_id", user.id)
        .eq("payment_provider", "google_play")
        .eq("status", "checkout_pending")
        .order("created_at", { ascending: false })
        .limit(1);
      pendingQuery = body.data.analysisId
        ? pendingQuery.eq("resume_analysis_id", body.data.analysisId)
        : pendingQuery;
      const { data } = await pendingQuery.maybeSingle();
      creditPurchase = data;
      creditPurchaseId = data?.id;
    }

    if (!creditPurchase) {
      const { data, error } = await admin
        .from("credit_purchases")
        .insert({
          user_id: user.id,
          payment_provider: "google_play",
          resume_analysis_id: body.data.analysisId ?? null,
          status: "checkout_pending",
          credits_granted: 5,
          credits_remaining: 0,
          amount_cents: 0,
          currency: order.total?.currencyCode?.toUpperCase() || "USD",
        })
        .select("id, status, resume_analysis_id, payment_provider")
        .single();
      if (error || !data) throw new Error("google_play_purchase_create_failed");
      creditPurchase = data;
      creditPurchaseId = data.id;
    }

    if (
      creditPurchase.payment_provider !== "google_play" ||
      !creditPurchaseId ||
      (body.data.analysisId &&
        creditPurchase.resume_analysis_id !== body.data.analysisId)
    ) {
      return Response.json(
        { error: "Google Play checkout state does not match." },
        { status: 409 },
      );
    }

    if (!knownToken) {
      const { error } = await admin.from("google_play_purchases").insert({
        purchase_token: body.data.purchaseToken,
        credit_purchase_id: creditPurchaseId,
        user_id: user.id,
        product_id: verified.productId,
        order_id: verified.orderId,
        purchase_state: verified.consumed ? "consumed" : "purchased",
        purchased_at: verified.purchasedAt,
        consumed_at: verified.consumed ? new Date().toISOString() : null,
      });
      if (error?.code === "23505") {
        return Response.json(
          { error: "Google Play purchase was already claimed." },
          { status: 409 },
        );
      }
      if (error) throw new Error("google_play_purchase_store_failed");
    }

    const money = googlePlayMoneyToCents(order.total);
    if (money) {
      await admin
        .from("credit_purchases")
        .update({
          amount_cents: money.amountCents,
          currency: money.currency,
        })
        .eq("id", creditPurchaseId);
    }

    const granted = await grantCreditPurchase({
      provider: "google_play",
      purchaseId: creditPurchaseId,
      userId: user.id,
      transactionId: verified.orderId,
      analysisId:
        body.data.analysisId ??
        creditPurchase.resume_analysis_id ??
        undefined,
    });

    if (!verified.consumed) {
      await consumeGooglePlayPurchase(
        verified.productId,
        body.data.purchaseToken,
      );
      await admin
        .from("google_play_purchases")
        .update({
          purchase_state: "consumed",
          consumed_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
        })
        .eq("purchase_token", body.data.purchaseToken);
    }

    return Response.json(granted);
  } catch {
    return Response.json(
      { error: "Google Play purchase could not be verified." },
      { status: 502 },
    );
  }
}
