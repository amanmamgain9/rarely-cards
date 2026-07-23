import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { getPaddle } from "@/lib/paddle";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const checkoutSchema = z.object({
  analysisId: z.string().uuid().optional(),
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
    .select("id, paddle_transaction_id")
    .eq("user_id", user.id)
    .eq("status", "checkout_pending")
    .gte("created_at", pendingCutoff)
    .order("created_at", { ascending: false })
    .limit(1);
  pendingQuery = body.data.analysisId
    ? pendingQuery.eq("resume_analysis_id", body.data.analysisId)
    : pendingQuery.is("resume_analysis_id", null);
  const { data: existingPending } = await pendingQuery.maybeSingle();

  if (existingPending?.paddle_transaction_id) {
    const transaction = await getPaddle().transactions.get(
      existingPending.paddle_transaction_id,
    );
    return Response.json({
      purchaseId: existingPending.id,
      transactionId: transaction.id,
      checkoutUrl: transaction.checkout?.url ?? null,
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
      .update({ paddle_transaction_id: transaction.id })
      .eq("id", purchase.id)
      .eq("status", "checkout_pending")
      .is("paddle_transaction_id", null);

    if (saveError) throw new Error("checkout_transaction_not_saved");

    return Response.json({
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
      .is("paddle_transaction_id", null);
    return Response.json(
      { error: "Checkout could not be created. Please try again." },
      { status: 502 },
    );
  }
}

