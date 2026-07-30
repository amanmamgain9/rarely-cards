import { z } from "zod";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { inspectImage } from "@/lib/analysis/image";
import { runAnalysis } from "@/lib/analysis/run-analysis";
import {
  acceptedAnalysisSchema,
  analysisStatusSchema,
  cardStyleSchema,
  petNameSchema,
  petPronounsSchema,
  type PublicAnalysis,
} from "@/lib/analysis/types";
import { reportServerError } from "@/lib/observability";
import { startFullRefund } from "@/lib/paddle";
import { resumeAnalysisAfterGrantedPurchase } from "@/lib/payments/credit-purchases";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const routeIdSchema = z.string().uuid();
const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("upload_complete") }),
  z.object({
    action: z.literal("set_pet_name"),
    petName: petNameSchema,
    pronouns: petPronounsSchema,
  }),
]);

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
      "id, card_style, pet_name, status, result_json, rejection_message, replacement_count, created_at, updated_at, processing_started_at, refund_attempted_at, card_photo_path, object_path",
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
  let photoUrl: string | null = null;
  const visiblePhotoPath =
    status === "completed" ? data.card_photo_path : data.object_path;
  if (visiblePhotoPath) {
    const { data: signedPhoto } = await createAdminClient().storage
      .from("analysis-photos")
      .createSignedUrl(visiblePhotoPath, 60 * 60);
    photoUrl = signedPhoto?.signedUrl ?? null;
  }

  const response: PublicAnalysis = {
    id: data.id,
    cardStyle: cardStyleSchema.parse(data.card_style),
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
  };

  const processingIsStale =
    status === "processing" &&
    data.processing_started_at &&
    Date.now() - new Date(data.processing_started_at).getTime() > 10 * 60 * 1000;
  if (status === "paid" || processingIsStale) {
    after(() => runAnalysis(id));
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

  const admin = createAdminClient();
  if (body.data.action === "set_pet_name") {
    const { data: current } = await admin
      .from("analysis_requests")
      .select("id, user_id, status, paddle_transaction_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!current) {
      return Response.json({ error: "Analysis not found." }, { status: 404 });
    }

    if (!current.paddle_transaction_id) {
      const { data: reservation, error: reservationError } = await admin.rpc(
        "reserve_credit_for_analysis",
        {
          p_user_id: user.id,
          p_analysis_id: id,
          p_pet_name: body.data.petName,
          p_pet_pronouns: body.data.pronouns,
        },
      );
      const reserved = reservation?.[0];
      if (reservationError) {
        return Response.json(
          { error: "This card is not waiting for a pet name." },
          { status: 409 },
        );
      }
      if (!reserved?.reserved) {
        await admin
          .from("analysis_requests")
          .update({ status: "awaiting_payment" })
          .eq("id", id)
          .eq("user_id", user.id)
          .in("status", ["awaiting_name", "awaiting_payment"]);
        return Response.json(
          {
            error: "Add a five-card pack to continue.",
            needsCredits: true,
            creditBalance: 0,
          },
          { status: 402 },
        );
      }

      await admin
        .from("analysis_requests")
        .update({ expires_at: null })
        .eq("id", id)
        .eq("user_id", user.id);
      after(() => runAnalysis(id));
      return Response.json({
        id,
        status: "paid",
        creditBalance: reserved.remaining_balance,
      });
    }

    const { data: named, error: nameError } = await admin
      .from("analysis_requests")
      .update({
        pet_name: body.data.petName,
        pet_pronouns: body.data.pronouns,
        status: "paid",
        expires_at: null,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "awaiting_name")
      .not("paddle_transaction_id", "is", null)
      .select("id")
      .maybeSingle();

    if (nameError || !named) {
      return Response.json(
        { error: "This card is not waiting for a pet name." },
        { status: 409 },
      );
    }

    after(() => runAnalysis(id));
    return Response.json({ id, status: "paid" });
  }

  const { data: analysis, error } = await admin
    .from("analysis_requests")
    .select("id, user_id, status, object_path, paddle_transaction_id")
    .eq("id", id)
    .single();

  if (error || !analysis || analysis.user_id !== user.id) {
    return Response.json({ error: "Analysis not found." }, { status: 404 });
  }
  if (analysis.status !== "awaiting_upload" || !analysis.object_path) {
    return Response.json({ error: "This upload is no longer expected." }, { status: 409 });
  }

  const { data: object, error: downloadError } = await admin.storage
    .from("analysis-photos")
    .download(analysis.object_path);

  if (downloadError || !object) {
    return Response.json({ error: "Upload not found. Please try again." }, { status: 409 });
  }

  try {
    const buffer = Buffer.from(await object.arrayBuffer());
    const image = await inspectImage(buffer);
    const { data: purchases } = await admin
      .from("credit_purchases")
      .select("credits_remaining")
      .eq("user_id", user.id)
      .eq("status", "active");
    const hasCredits =
      (purchases ?? []).reduce(
        (sum, purchase) => sum + purchase.credits_remaining,
        0,
      ) > 0;
    const nextStatus = analysis.paddle_transaction_id
      ? "paid"
      : hasCredits
        ? "awaiting_name"
        : "awaiting_payment";
    const { data: updated, error: updateError } = await admin
      .from("analysis_requests")
      .update({
        status: nextStatus,
        image_mime_type: image.mimeType,
        image_bytes: image.bytes,
        image_width: image.width,
        image_height: image.height,
        photo_uploaded_at: new Date().toISOString(),
        expires_at: null,
        rejection_reason: null,
        rejection_message: null,
      })
      .eq("id", id)
      .eq("status", "awaiting_upload")
      .select("status")
      .single();

    if (updateError || !updated) {
      return Response.json({ error: "Upload state changed. Refresh and try again." }, { status: 409 });
    }

    if (updated.status === "paid") {
      after(() => runAnalysis(id));
    }
    return Response.json({
      id,
      status: updated.status,
      needsCredits: updated.status === "awaiting_payment",
    });
  } catch {
    await admin.storage.from("analysis-photos").remove([analysis.object_path]);
    await admin
      .from("analysis_requests")
      .update({
        object_path: null,
        image_mime_type: null,
        image_bytes: null,
        image_width: null,
        image_height: null,
        status: analysis.paddle_transaction_id ? "photo_rejected" : "awaiting_upload",
        rejection_reason: "invalid_file",
        rejection_message:
          "That file is not a usable JPEG, PNG, or WebP. Choose a clear photo and try again.",
      })
      .eq("id", id)
      .eq("status", "awaiting_upload");

    return Response.json(
      { error: "Choose a valid JPEG, PNG, or WebP between 256px and 6000px." },
      { status: 422 },
    );
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

  const admin = createAdminClient();
  const { data: analysis } = await admin
    .from("analysis_requests")
    .select("id, status, card_photo_path, object_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!analysis) {
    return Response.json({ error: "Card not found." }, { status: 404 });
  }
  const savedPhotoPaths = [analysis.card_photo_path, analysis.object_path].filter(
    (path): path is string => Boolean(path),
  );
  if (savedPhotoPaths.length === 0) {
    return Response.json(
      { error: "This card has no saved photo." },
      { status: 409 },
    );
  }
  const photoPaths = Array.from(
    new Set([
      ...savedPhotoPaths,
      `${user.id}/${analysis.id}/zazzle-card.png`,
    ]),
  );

  const { error: storageError } = await admin.storage
    .from("analysis-photos")
    .remove(photoPaths);
  if (storageError) {
    return Response.json({ error: "Photo could not be deleted." }, { status: 502 });
  }
  await admin
    .from("analysis_requests")
    .update({ card_photo_path: null, object_path: null })
    .eq("id", id)
    .eq("user_id", user.id);

  return Response.json({ deleted: true });
}
