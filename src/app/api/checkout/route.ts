import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  hasGooglePlayEnv,
  hasPaddleEnv,
  hasSeedanceEnv,
  paddleEnv,
} from "@/lib/env";
import { getOrCreatePaddleCustomerId, getPaddle } from "@/lib/payments/paddle";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const checkoutSchema = z.object({
  analysisId: z.string().uuid().optional(),
  provider: z.enum(["paddle", "google_play"]).default("paddle"),
});
const ACCOUNT_CHECKOUT_SCOPE = "00000000-0000-0000-0000-000000000000";

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
  if (!hasSeedanceEnv()) {
    return Response.json(
      { error: "Talking-pet video checkout is not available yet." },
      { status: 503 },
    );
  }
  if (
    (provider === "paddle" && !hasPaddleEnv()) ||
    (provider === "google_play" && !hasGooglePlayEnv())
  ) {
    return Response.json(
      { error: "This checkout provider is not configured." },
      { status: 503 },
    );
  }
  if (provider === "paddle" && !user.email) {
    return Response.json(
      { error: "Your account needs an email address before checkout." },
      { status: 400 },
    );
  }

  let paddleCustomerId: string | null = null;
  if (provider === "paddle") {
    try {
      paddleCustomerId = await getOrCreatePaddleCustomerId(user.id, user.email!);
    } catch {
      return Response.json(
        { error: "Checkout customer could not be prepared. Please try again." },
        { status: 502 },
      );
    }
  }

  const admin = createAdminClient();
  if (body.data.analysisId) {
    const { data: analysis, error } = await admin
      .from("analysis_requests")
      .select("id, user_id, status, experience_kind")
      .eq("id", body.data.analysisId)
      .single();
    if (error || !analysis || analysis.user_id !== user.id) {
      return Response.json({ error: "Analysis not found." }, { status: 404 });
    }
    if (
      !["talking_video", "birthday_video", "movie_scene"].includes(analysis.experience_kind) ||
      !["awaiting_payment", "awaiting_name"].includes(analysis.status)
    ) {
      return Response.json(
        { error: "This draft is not waiting for video credits." },
        { status: 409 },
      );
    }
  }

  let pendingQuery = admin
    .from("credit_purchases")
    .select("id, provider_checkout_id, provider_transaction_id, created_at")
    .eq("user_id", user.id)
    .eq("payment_provider", provider)
    .eq("status", "checkout_pending")
    .eq("credit_kind", "talking_video")
    .order("created_at", { ascending: false })
    .limit(1);
  pendingQuery = body.data.analysisId
    ? pendingQuery.eq("resume_analysis_id", body.data.analysisId)
    : pendingQuery.is("resume_analysis_id", null);
  let { data: existingPending } = await pendingQuery.maybeSingle();

  if (
    existingPending &&
    !existingPending.provider_checkout_id &&
    Date.now() - new Date(existingPending.created_at).getTime() > 2 * 60_000
  ) {
    const { data: released } = await admin
      .from("credit_purchases")
      .update({ pending_checkout_guarded: false })
      .eq("id", existingPending.id)
      .eq("status", "checkout_pending")
      .is("provider_checkout_id", null)
      .select("id")
      .maybeSingle();
    if (released) existingPending = null;
  }

  if (existingPending?.provider_checkout_id) {
    if (provider === "paddle" && existingPending.provider_transaction_id) {
      const pending = existingPending;
      const transactionId = existingPending.provider_transaction_id;
      try {
        let transaction = await getPaddle().transactions.get(transactionId);
        if (transaction.status === "canceled") {
          const { data: canceled } = await admin
            .from("credit_purchases")
            .update({ status: "failed" })
            .eq("id", pending.id)
            .eq("status", "checkout_pending")
            .select("id")
            .maybeSingle();
          if (canceled) existingPending = null;
        } else {
          if (!transaction.customerId && paddleCustomerId) {
            transaction = await getPaddle().transactions.update(transaction.id, {
              customerId: paddleCustomerId,
            });
          }
          return Response.json({
            provider,
            purchaseId: pending.id,
            transactionId: transaction.id,
            checkoutUrl: transaction.checkout?.url ?? null,
            existing: true,
          });
        }
      } catch {
        if (
          Date.now() - new Date(pending.created_at).getTime() >
          24 * 60 * 60_000
        ) {
          const { data: released } = await admin
            .from("credit_purchases")
            .update({ pending_checkout_guarded: false })
            .eq("id", pending.id)
            .eq("status", "checkout_pending")
            .select("id")
            .maybeSingle();
          if (released) existingPending = null;
        }
        if (existingPending) {
          return Response.json(
            { error: "Existing checkout could not be loaded. Try again shortly." },
            { status: 502 },
          );
        }
      }
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
      checkout_scope_id: body.data.analysisId ?? ACCOUNT_CHECKOUT_SCOPE,
      status: "checkout_pending",
      credit_kind: "talking_video",
      credits_granted: 3,
      credits_remaining: 0,
      amount_cents: 1000,
      currency: "USD",
    })
    .select("id")
    .single();
  if (purchaseError || !purchase) {
    if (purchaseError?.code === "23505") {
      return Response.json(
        { error: "Checkout is already being prepared. Try again in a moment." },
        { status: 409 },
      );
    }
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

    const env = paddleEnv();
    const transaction = await getPaddle().transactions.create({
      items: [{ priceId: env.paddlePriceId, quantity: 1 }],
      collectionMode: "automatic",
      customerId: paddleCustomerId!,
      customData: {
        user_id: user.id,
        credit_purchase_id: purchase.id,
        analysis_request_id: body.data.analysisId ?? null,
        entitlement: "three_talking_pet_videos",
        credits: 3,
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
      .update({ pending_checkout_guarded: false })
      .eq("id", purchase.id)
      .eq("status", "checkout_pending")
      .is("provider_checkout_id", null);
    return Response.json(
      { error: "Checkout could not be created. Please try again." },
      { status: 502 },
    );
  }
}
