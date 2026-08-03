import { z } from "zod";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  AnalysisActionError,
  confirmAnalysisUpload,
} from "@/lib/analysis/actions";
import {
  AnalysisDeleteError,
  deleteDraft,
  deleteDraftPhotos,
  deleteSavedAnalysis,
} from "@/lib/analysis/delete";
import {
  acceptedAnalysisSchema,
  analysisStatusSchema,
  cardStyleSchema,
  type PublicAnalysis,
} from "@/lib/analysis/types";
import { reportServerError } from "@/lib/observability";
import { startFullRefund } from "@/lib/paddle";
import { resumeAnalysisAfterGrantedPurchase } from "@/lib/payments/credit-purchases";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { petDialogueSuggestionsSchema } from "@/lib/video/dialogue";

const routeIdSchema = z.string().uuid();
const updateSchema = z.object({ action: z.literal("upload_complete") });

type RouteContext = { params: Promise<{ id: string }> };

export const maxDuration = 60;

export async function GET(request: Request, context: RouteContext) {
  const { user, supabase } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const limit = await checkRateLimit({
    request,
    scope: "analysis-status",
    userId: user.id,
    limit: 120,
    windowSeconds: 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const { id } = await context.params;
  if (!routeIdSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid analysis." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("analysis_requests")
    .select(
      "id, card_style, experience_kind, pet_name, pet_pronouns, status, result_json, rejection_message, replacement_count, created_at, updated_at, processing_started_at, refund_attempted_at, card_photo_path, object_path, dialogue_suggestions, selected_dialogue",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return Response.json({ error: "Analysis not found." }, { status: 404 });
  }

  let status = analysisStatusSchema.parse(data.status);

  // A successful checkout and its webhook are separate requests. If the
  // purchase was granted but the follow-up analysis update was interrupted,
  // do not strand the user on the payment screen forever.
  if (status === "awaiting_payment") {
    const resumed = await resumeAnalysisAfterGrantedPurchase({
      userId: user.id,
      analysisId: id,
    });
    if (resumed) status = "awaiting_name";
  }
  const parsedResult =
    status === "completed" ? acceptedAnalysisSchema.parse(data.result_json) : null;
  const result =
    parsedResult && !parsedResult.petName && data.pet_name
      ? { ...parsedResult, petName: data.pet_name }
      : parsedResult;
  const visiblePhotoPath =
    status === "completed"
      ? data.card_photo_path ?? data.object_path
      : data.object_path;
  const photoUrl = visiblePhotoPath ? `/api/analyses/${id}/photo` : null;

  const response: PublicAnalysis = {
    id: data.id,
    petName: data.pet_name,
    petPronouns: data.pet_pronouns,
    cardStyle: cardStyleSchema.parse(data.card_style),
    experienceKind: data.experience_kind,
    status,
    result,
    rejectionMessage: data.rejection_message,
    replacementCount: data.replacement_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    photoUrl,
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

  if (status === "photo_rejected") {
    after(() =>
      createAdminClient().rpc("restore_talking_video_credit", {
        p_analysis_id: id,
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
        await startFullRefund(id);
      } catch (error) {
        reportServerError(error, {
          operation: "analysis_refund_reconciliation",
          analysisId: id,
        });
      }
    });
  }

  return Response.json(response, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  const body = updateSchema.safeParse(await request.json().catch(() => null));
  if (!routeIdSchema.safeParse(id).success || !body.success) {
    return Response.json({ error: "Invalid upload confirmation." }, { status: 400 });
  }

  try {
    const result = await confirmAnalysisUpload({
      userId: user.id,
      analysisId: id,
    });
    return Response.json(result.payload);
  } catch (error) {
    if (error instanceof AnalysisActionError) {
      return Response.json(
        { error: error.message, ...error.details },
        { status: error.status },
      );
    }
    throw error;
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const limit = await checkRateLimit({
    request,
    scope: "card-photo-delete",
    userId: user.id,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const { id } = await context.params;
  if (!routeIdSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid card." }, { status: 400 });
  }

  const draftDeleteRequested =
    new URL(request.url).searchParams.get("draft") === "1";
  try {
    if (draftDeleteRequested) {
      const photoPaths = await deleteDraft(user.id, id);
      after(() => deleteDraftPhotos(id, photoPaths));
    } else {
      await deleteSavedAnalysis(user.id, id);
    }
    return Response.json({ deleted: true });
  } catch (error) {
    if (error instanceof AnalysisDeleteError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
