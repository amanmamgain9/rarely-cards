import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  hasGooglePlayEnv,
  hasLemonSqueezyEnv,
  hasPaddleEnv,
  serverEnv,
} from "@/lib/env";
import {
  createLemonSqueezyCheckout,
  getLemonSqueezyCheckout,
} from "@/lib/lemon-squeezy";
import { getPaddle } from "@/lib/paddle";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const checkoutSchema = z.object({
  analysisId: z.string().uuid().optional(),
  provider: z
    .enum(["lemon_squeezy", "paddle", "google_play"])
    .default("lemon_squeezy"),
});

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const limit = await checkRateLimit({
    request,
    scope: "checkout-create",
    userId: user.id,
    limit: 8,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const body = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid checkout request." }, { status: 400 });
  }
  const provider = body.data.provider;
  if (
    (provider === "lemon_squeezy" && !hasLemonSqueezyEnv()) ||
    (provider === "paddle" && !hasPaddleEnv()) ||
    (provider === "google_play" && !hasGooglePlayEnv())
  ) {
    return Response.json(
      { error: "This checkout provider is not configured." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  if (body.data.analysisId) {
    const { data: analysis, error } = await admin
      .from("analysis_requests")
      .select("id, user_id, status")
      .eq("id", body.data.analysisId)
      .single();
    if (error || !analysis || analysis.user_id !== user.id) {
      return Response.json({ error: "Analysis not found." }, { status: 404 });
    }
    if (!["awaiting_payment", "awaiting_name"].includes(analysis.status)) {
      return Response.json(
        { error: "This card is not waiting for credits." },
        { status: 409 },
      );
    }
  }

  const pendingCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  let pendingQuery = admin
    .from("credit_purchases")
    .select("id, provider_checkout_id, provider_transaction_id")
    .eq("user_id", user.id)
    .eq("payment_provider", provider)
    .eq("status", "checkout_pending")
    .gte("created_at", pendingCutoff)
    .order("created_at", { ascending: false })
    .limit(1);
  pendingQuery = body.data.analysisId
    ? pendingQuery.eq("resume_analysis_id", body.data.analysisId)
    : pendingQuery.is("resume_analysis_id", null);
  const { data: existingPending } = await pendingQuery.maybeSingle();

  if (existingPending?.provider_checkout_id) {
    if (provider === "paddle" && existingPending.provider_transaction_id) {
      const transaction = await getPaddle().transactions.get(
        existingPending.provider_transaction_id,
      );
      return Response.json({
        provider,
        purchaseId: existingPending.id,
        transactionId: transaction.id,
        checkoutUrl: transaction.checkout?.url ?? null,
        existing: true,
      });
    }
    if (provider === "lemon_squeezy") {
      const checkout = await getLemonSqueezyCheckout(
        existingPending.provider_checkout_id,
      );
      return Response.json({
        provider,
        purchaseId: existingPending.id,
        transactionId: null,
        checkoutUrl: checkout.url,
        existing: true,
      });
    }
  }
  if (provider === "google_play" && existingPending) {
    return Response.json({
      provider,
      purchaseId: existingPending.id,
      transactionId: null,
      checkoutUrl: null,
      existing: true,
    });
  }
  if (existingPending) {
    return Response.json(
      { error: "Checkout is already being prepared. Try again in a moment." },
      { status: 409 },
    );
  }

  const { data: purchase, error: purchaseError } = await admin
    .from("credit_purchases")
    .insert({
      user_id: user.id,
      payment_provider: provider,
      resume_analysis_id: body.data.analysisId ?? null,
      status: "checkout_pending",
      credits_granted: 5,
      credits_remaining: 0,
      amount_cents: 500,
      currency: "USD",
    })
    .select("id")
    .single();
  if (purchaseError || !purchase) {
    return Response.json(
      { error: "Checkout could not be prepared. Please try again." },
      { status: 500 },
    );
  }

  try {
    if (provider === "google_play") {
      return Response.json({
        provider,
        purchaseId: purchase.id,
        transactionId: null,
        checkoutUrl: null,
        existing: false,
      });
    }
    if (provider === "lemon_squeezy") {
      const checkout = await createLemonSqueezyCheckout({
        userId: user.id,
        email: user.email ?? null,
        purchaseId: purchase.id,
        analysisId: body.data.analysisId,
      });
      const { error: saveError } = await admin
        .from("credit_purchases")
        .update({ provider_checkout_id: checkout.id })
        .eq("id", purchase.id)
        .eq("status", "checkout_pending")
        .is("provider_checkout_id", null);
      if (saveError) throw new Error("checkout_not_saved");
      return Response.json({
        provider,
        purchaseId: purchase.id,
        transactionId: null,
        checkoutUrl: checkout.url,
        existing: false,
      });
    }

    const env = serverEnv();
    const transaction = await getPaddle().transactions.create({
      items: [{ priceId: env.paddlePriceId, quantity: 1 }],
      collectionMode: "automatic",
      customData: {
        user_id: user.id,
        credit_purchase_id: purchase.id,
        analysis_request_id: body.data.analysisId ?? null,
        entitlement: "five_card_credits",
        credits: 5,
      },
      checkout: {
        url: body.data.analysisId ? env.appUrl : `${env.appUrl}/account`,
      },
    });
    const { error: saveError } = await admin
      .from("credit_purchases")
      .update({
        provider_checkout_id: transaction.id,
        provider_transaction_id: transaction.id,
      })
      .eq("id", purchase.id)
      .eq("status", "checkout_pending")
      .is("provider_checkout_id", null);
    if (saveError) throw new Error("checkout_transaction_not_saved");
    return Response.json({
      provider,
      purchaseId: purchase.id,
      transactionId: transaction.id,
      checkoutUrl: transaction.checkout?.url ?? null,
      existing: false,
    });
  } catch {
    await admin
      .from("credit_purchases")
      .update({ status: "failed" })
      .eq("id", purchase.id)
      .eq("status", "checkout_pending")
      .is("provider_checkout_id", null);
    return Response.json(
      { error: "Checkout could not be created. Please try again." },
      { status: 502 },
    );
  }
}

