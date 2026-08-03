import type { AccountData } from "@/lib/account-types";
import { after } from "next/server";
import {
  acceptedAnalysisSchema,
  analysisStatusSchema,
} from "@/lib/analysis/types";
import { requireUser } from "@/lib/auth";
import { hasSeedanceEnv } from "@/lib/env";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSeedanceVideo } from "@/lib/video/generation";
import {
  developmentVideoCreditBalance,
  ensureDevelopmentVideoCredits,
  isDevelopmentBillingBypassed,
  isDevelopmentCreditPurchase,
} from "@/lib/payments/development-credits";

const AMBIGUOUS_SUBMISSION_TTL_MS = 65 * 60_000;

export async function GET(request: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  await ensureDevelopmentVideoCredits(user.id);

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
      .select("credits_remaining, provider_transaction_id, credit_kind")
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
        creditBalance: developmentVideoCreditBalance((activePurchases ?? []).reduce(
          (sum, purchase) =>
            sum + (purchase.credit_kind === "talking_video" ? purchase.credits_remaining : 0),
          0,
        )),
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

  const [
    { data: purchaseRows, error: purchaseError },
    { data: analysisRows, error: analysisError },
    { data: videoRows, error: videoError },
  ] =
    await Promise.all([
      admin
        .from("credit_purchases")
        .select(
          "id, payment_provider, provider_transaction_id, status, credits_granted, credits_remaining, credit_kind, amount_cents, currency, completed_at, created_at",
        )
        .eq("user_id", user.id)
        .neq("status", "failed")
        .order("created_at", { ascending: false }),
      admin
        .from("analysis_requests")
        .select(
          "id, status, pet_name, result_json, card_photo_path, object_path, credit_purchase_id, experience_kind, selected_dialogue, rejection_message, credit_state, created_at, completed_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("video_generations")
        .select("id, analysis_id, status, provider_task_id, output_path, error_code, discard_requested_at, updated_at")
        .eq("user_id", user.id),
    ]);

  if (purchaseError || analysisError || videoError) {
    return Response.json({ error: "Account could not be loaded." }, { status: 500 });
  }

  const videosByAnalysis = new Map(
    (videoRows ?? []).map((video) => [video.analysis_id, video]),
  );
  const creditKindByPurchase = new Map(
    (purchaseRows ?? []).map((purchase) => [purchase.id, purchase.credit_kind]),
  );
  for (const video of videoRows ?? []) {
    const submissionAge = Date.now() - new Date(video.updated_at).getTime();
    const staleSubmission =
      video.status === "submitting" &&
      submissionAge >
        (!video.provider_task_id
          ? AMBIGUOUS_SUBMISSION_TTL_MS
          : 2 * 60_000);
    if (
      staleSubmission &&
      !video.provider_task_id &&
      !video.discard_requested_at
    ) {
      after(async () => {
        const { error: restoreError } = await admin.rpc(
          "restore_talking_video_credit",
          { p_analysis_id: video.analysis_id },
        );
        if (!restoreError) {
          await admin.from("video_generations").delete().eq("id", video.id);
        }
      });
    } else if (
      video.discard_requested_at &&
      staleSubmission &&
      !video.provider_task_id
    ) {
      after(() =>
        admin
          .from("video_generations")
          .update({
            status: "failed",
            error_code: "seedance_ambiguous_submission_expired",
            updated_at: new Date().toISOString(),
          })
          .eq("id", video.id)
          .eq("status", "submitting"),
      );
    } else if (video.discard_requested_at || video.status === "running") {
      after(() => syncSeedanceVideo(video.id));
    } else if (
      staleSubmission
    ) {
      after(async () => {
        const { data: failed } = await admin
          .from("video_generations")
          .update({
            status: "failed",
            error_code: "seedance_submission_interrupted",
            updated_at: new Date().toISOString(),
          })
          .eq("id", video.id)
          .eq("status", "submitting")
          .select("analysis_id")
          .maybeSingle();
        if (failed) {
          await admin.rpc("consume_analysis_credit", {
            p_analysis_id: failed.analysis_id,
          });
        }
      });
    }
  }
  for (const analysis of analysisRows ?? []) {
    if (
      analysis.status === "photo_rejected" &&
      (analysis.credit_state === "reserved" || analysis.credit_state === "consumed")
    ) {
      after(() =>
        admin.rpc("restore_talking_video_credit", {
          p_analysis_id: analysis.id,
        }),
      );
    }
  }
  const cards = (analysisRows ?? []).map((row) => {
      const parsedResult = acceptedAnalysisSchema.safeParse(row.result_json);
      const visiblePhotoPath = row.card_photo_path ?? row.object_path;
      const video = videosByAnalysis.get(row.id);
      return {
        id: row.id,
        status: analysisStatusSchema.parse(row.status),
        petName: row.pet_name,
        result: parsedResult.success
          ? parsedResult.data.petName || !row.pet_name
            ? parsedResult.data
            : { ...parsedResult.data, petName: row.pet_name }
          : null,
        photoUrl: visiblePhotoPath ? `/api/analyses/${row.id}/photo` : null,
        videoUrl:
          video?.status === "succeeded" && video.output_path
            ? `/api/analyses/${row.id}/video/file`
            : null,
        videoStatus: video?.status ?? null,
        videoEligible: hasSeedanceEnv() && Boolean(
          row.selected_dialogue &&
            visiblePhotoPath &&
            !video &&
            ["reserved", "consumed"].includes(row.credit_state || ""),
        ),
        creditKind:
          row.experience_kind ??
          creditKindByPurchase.get(row.credit_purchase_id || "") ??
          "talking_video",
        rejectionMessage: row.rejection_message,
        creditState: row.credit_state,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      };
    });

  const purchases = (purchaseRows ?? [])
    .filter((row) => !isDevelopmentCreditPurchase(row.provider_transaction_id))
    .map((row) => {
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
      creditKind: row.credit_kind,
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
    creditBalance: developmentVideoCreditBalance(purchases
      .filter((purchase) => purchase.status === "active" && purchase.creditKind === "talking_video")
      .reduce((sum, purchase) => sum + purchase.creditsRemaining, 0)),
    purchases,
    cards,
    developmentMode: isDevelopmentBillingBypassed(),
  };

  return Response.json(response, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
