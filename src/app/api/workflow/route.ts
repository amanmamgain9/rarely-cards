import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { runAnalysis } from "@/lib/analysis/run-analysis";
import {
  acceptedAnalysisSchema,
  analysisStatusSchema,
  cardStyleSchema,
  type PublicAnalysis,
} from "@/lib/analysis/types";
import { petDialogueSuggestionsSchema } from "@/lib/video/dialogue";
import { reportServerError } from "@/lib/observability";
import { startFullRefund } from "@/lib/paddle";
import { resumeAnalysisAfterGrantedPurchase } from "@/lib/payments/credit-purchases";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkflowSnapshot } from "@/lib/workflow/types";
import {
  developmentVideoCreditBalance,
  ensureDevelopmentVideoCredits,
} from "@/lib/payments/development-credits";

const analysisIdSchema = z.string().uuid();

export const maxDuration = 60;

export async function GET(request: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  await ensureDevelopmentVideoCredits(user.id);

  const limit = await checkRateLimit({
    request,
    scope: "workflow-read",
    userId: user.id,
    limit: 120,
    windowSeconds: 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const candidateId = new URL(request.url).searchParams.get("analysisId");
  const analysisId = candidateId
    ? analysisIdSchema.safeParse(candidateId)
    : null;
  if (analysisId && !analysisId.success) {
    return Response.json({ error: "Invalid analysis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: purchases, error: purchaseError } = await admin
    .from("credit_purchases")
    .select("credits_remaining, credit_kind")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (purchaseError) {
    return Response.json(
      { error: "Workflow could not be loaded." },
      { status: 500 },
    );
  }
  const creditBalance = developmentVideoCreditBalance((purchases ?? []).reduce(
    (sum, purchase) =>
      sum + (purchase.credit_kind === "talking_video" ? purchase.credits_remaining : 0),
    0,
  ));
  const legacyCardCreditBalance = (purchases ?? []).reduce(
    (sum, purchase) =>
      sum + (purchase.credit_kind === "card" ? purchase.credits_remaining : 0),
    0,
  );

  if (!analysisId?.success) {
    return Response.json(
      { creditBalance, legacyCardCreditBalance, analysis: null } satisfies WorkflowSnapshot,
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { data, error } = await admin
    .from("analysis_requests")
    .select(
      "id, user_id, card_style, experience_kind, pet_name, status, result_json, rejection_message, replacement_count, created_at, updated_at, processing_started_at, refund_attempted_at, card_photo_path, object_path, dialogue_suggestions, selected_dialogue",
    )
    .eq("id", analysisId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) {
    return Response.json({ error: "Analysis not found." }, { status: 404 });
  }

  let status = analysisStatusSchema.parse(data.status);
  if (status === "awaiting_payment") {
    const resumed = await resumeAnalysisAfterGrantedPurchase({
      userId: user.id,
      analysisId: data.id,
    });
    if (resumed) status = "awaiting_name";
  }

  const parsedResult =
    status === "completed"
      ? acceptedAnalysisSchema.parse(data.result_json)
      : null;
  const result =
    parsedResult && !parsedResult.petName && data.pet_name
      ? { ...parsedResult, petName: data.pet_name }
      : parsedResult;
  const visiblePhotoPath =
    status === "completed"
      ? data.card_photo_path ?? data.object_path
      : data.object_path;
  const analysis: PublicAnalysis = {
    id: data.id,
    petName: data.pet_name,
    cardStyle: cardStyleSchema.parse(data.card_style),
    experienceKind: data.experience_kind,
    status,
    result,
    rejectionMessage: data.rejection_message,
    replacementCount: data.replacement_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    photoUrl: visiblePhotoPath ? `/api/analyses/${data.id}/photo` : null,
    refundState:
      status === "refund_pending"
        ? "pending"
        : status === "refunded"
          ? "completed"
          : "none",
    dialogueSuggestions:
      petDialogueSuggestionsSchema.safeParse(data.dialogue_suggestions).data ?? [],
    selectedDialogue: data.selected_dialogue,
  };

  const processingIsStale =
    status === "processing" &&
    data.processing_started_at &&
    Date.now() - new Date(data.processing_started_at).getTime() > 10 * 60_000;
  if (status === "paid" || processingIsStale) {
    after(() => runAnalysis(data.id));
  }
  if (status === "photo_rejected") {
    after(() =>
      admin.rpc("restore_talking_video_credit", {
        p_analysis_id: data.id,
      }),
    );
  }
  const refundReconciliationIsDue =
    (status === "refund_pending" || status === "refunded") &&
    (!data.refund_attempted_at ||
      Date.now() - new Date(data.refund_attempted_at).getTime() > 5 * 60_000);
  if (refundReconciliationIsDue) {
    after(async () => {
      try {
        await startFullRefund(data.id);
      } catch (refundError) {
        reportServerError(refundError, {
          operation: "workflow_refund_reconciliation",
          analysisId: data.id,
        });
      }
    });
  }

  return Response.json(
    { creditBalance, legacyCardCreditBalance, analysis } satisfies WorkflowSnapshot,
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
