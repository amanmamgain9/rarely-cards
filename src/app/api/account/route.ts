import type { AccountData } from "@/lib/account-types";
import {
  acceptedAnalysisSchema,
  analysisStatusSchema,
} from "@/lib/analysis/types";
import { requireUser } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const limit = await checkRateLimit({
    request,
    scope: "account-read",
    userId: user.id,
    limit: 60,
    windowSeconds: 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const admin = createAdminClient();
  const searchParams = new URL(request.url).searchParams;
  if (searchParams.get("view") === "balance") {
    const transactionId = searchParams.get("transactionId");
    const validTransactionId =
      transactionId && transactionId.length <= 100 ? transactionId : null;
    const { data: activePurchases, error } = await admin
      .from("credit_purchases")
      .select("credits_remaining, provider_transaction_id")
      .eq("user_id", user.id)
      .eq("status", "active");
    if (error) {
      return Response.json(
        { error: "Credit balance could not be loaded." },
        { status: 500 },
      );
    }
    return Response.json(
      {
        creditBalance: (activePurchases ?? []).reduce(
          (sum, purchase) => sum + purchase.credits_remaining,
          0,
        ),
        transactionConfirmed:
          Boolean(validTransactionId) &&
          (activePurchases ?? []).some(
            (purchase) =>
              purchase.provider_transaction_id === validTransactionId,
          ),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const [{ data: purchaseRows, error: purchaseError }, { data: analysisRows, error: analysisError }] =
    await Promise.all([
      admin
        .from("credit_purchases")
        .select(
          "id, payment_provider, status, credits_granted, credits_remaining, amount_cents, currency, completed_at, created_at",
        )
        .eq("user_id", user.id)
        .neq("status", "failed")
        .order("created_at", { ascending: false }),
      admin
        .from("analysis_requests")
        .select(
          "id, status, pet_name, result_json, card_photo_path, object_path, rejection_message, credit_state, created_at, completed_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (purchaseError || analysisError) {
    return Response.json({ error: "Account could not be loaded." }, { status: 500 });
  }

  const photoPaths = (analysisRows ?? [])
    .map((row) => row.card_photo_path ?? row.object_path)
    .filter((path): path is string => Boolean(path));
  const { data: signedPhotos } =
    photoPaths.length > 0
      ? await admin.storage
          .from("analysis-photos")
          .createSignedUrls(photoPaths, 60 * 60)
      : { data: [] };
  const signedPhotoByPath = new Map(
    (signedPhotos ?? []).flatMap((photo) =>
      photo.path && photo.signedUrl ? [[photo.path, photo.signedUrl]] : [],
    ),
  );

  const cards = (analysisRows ?? []).map((row) => {
      const parsedResult = acceptedAnalysisSchema.safeParse(row.result_json);
      const visiblePhotoPath = row.card_photo_path ?? row.object_path;
      return {
        id: row.id,
        status: analysisStatusSchema.parse(row.status),
        petName: row.pet_name,
        result: parsedResult.success
          ? parsedResult.data.petName || !row.pet_name
            ? parsedResult.data
            : { ...parsedResult.data, petName: row.pet_name }
          : null,
        photoUrl: visiblePhotoPath
          ? signedPhotoByPath.get(visiblePhotoPath) ?? null
          : null,
        rejectionMessage: row.rejection_message,
        creditState: row.credit_state,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      };
    });

  const purchases = (purchaseRows ?? []).map((row) => {
    const refundableUntil = row.completed_at
      ? new Date(
          new Date(row.completed_at).getTime() + 14 * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;
    return {
      id: row.id,
      paymentProvider: row.payment_provider,
      status: row.status,
      creditsGranted: row.credits_granted,
      creditsRemaining: row.credits_remaining,
      amountCents: row.amount_cents,
      currency: row.currency,
      purchasedAt: row.completed_at,
      createdAt: row.created_at,
      refundableUntil,
      refundable:
        (row.payment_provider === "paddle" ||
          row.payment_provider === "google_play") &&
        (row.status === "active" || row.status === "refund_pending") &&
        refundableUntil !== null &&
        new Date(refundableUntil).getTime() > Date.now(),
    };
  });

  const response: AccountData = {
    email: user.email ?? null,
    creditBalance: purchases
      .filter((purchase) => purchase.status === "active")
      .reduce((sum, purchase) => sum + purchase.creditsRemaining, 0),
    purchases,
    cards,
  };

  return Response.json(response, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
