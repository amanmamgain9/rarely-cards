import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prepareImageForGemini } from "@/lib/analysis/image";
import { suggestPetDialogue } from "@/lib/ai/gemini";
import { reportServerError } from "@/lib/observability";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { petDialogueSuggestionsSchema } from "@/lib/video/dialogue";

const routeIdSchema = z.string().uuid();
type RouteContext = { params: Promise<{ id: string }> };

export const maxDuration = 60;

export async function POST(request: Request, context: RouteContext) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return Response.json(
      { error: "Gemini suggestions are not configured yet." },
      { status: 503 },
    );
  }

  const limit = await checkRateLimit({
    request,
    scope: "pet-dialogue-suggestions",
    userId: user.id,
    limit: 8,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const { id } = await context.params;
  if (!routeIdSchema.safeParse(id).success) {
    return Response.json({ error: "Invalid pet photo." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: analysis } = await admin
    .from("analysis_requests")
    .select("id, user_id, status, object_path, dialogue_suggestions")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!analysis?.object_path) {
    return Response.json({ error: "Pet photo not found." }, { status: 404 });
  }
  const existing = petDialogueSuggestionsSchema.safeParse(
    analysis.dialogue_suggestions,
  );
  if (existing.success) {
    return Response.json({ status: "accepted", suggestions: existing.data });
  }
  if (!["awaiting_name", "awaiting_payment"].includes(analysis.status)) {
    return Response.json(
      { error: "This pet is no longer waiting for a line." },
      { status: 409 },
    );
  }

  try {
    const { data: object, error } = await admin.storage
      .from("analysis-photos")
      .download(analysis.object_path);
    if (error || !object) throw new Error("dialogue_photo_download_failed");
    const image = await prepareImageForGemini(
      Buffer.from(await object.arrayBuffer()),
    );
    const result = await suggestPetDialogue(image);
    if (result.status === "rejected") {
      const { data: rejected, error: rejectionError } = await admin
        .from("analysis_requests")
        .update({
          status: "photo_rejected",
          rejection_reason: result.reason,
          rejection_message: result.message,
          dialogue_suggestions: null,
        })
        .eq("id", analysis.id)
        .eq("user_id", user.id)
        .in("status", ["awaiting_name", "awaiting_payment"])
        .select("id")
        .maybeSingle();
      if (rejectionError) throw new Error("dialogue_photo_rejection_store_failed");
      if (!rejected) {
        return Response.json(
          { error: "This pet is no longer waiting for a line." },
          { status: 409 },
        );
      }
      return Response.json(result);
    }
    const suggestions = result.suggestions;
    const { data: saved, error: saveError } = await admin
      .from("analysis_requests")
      .update({ dialogue_suggestions: suggestions })
      .eq("id", analysis.id)
      .eq("user_id", user.id)
      .in("status", ["awaiting_name", "awaiting_payment"])
      .is("dialogue_suggestions", null)
      .select("dialogue_suggestions")
      .maybeSingle();
    if (saveError) throw new Error("dialogue_suggestions_store_failed");
    const raced = petDialogueSuggestionsSchema.safeParse(
      saved?.dialogue_suggestions,
    );
    return Response.json({
      status: "accepted",
      suggestions: raced.success ? raced.data : suggestions,
    });
  } catch (error) {
    reportServerError(error, {
      operation: "pet_dialogue_suggestions",
      analysisId: id,
    });
    return Response.json(
      { error: "We could not read this moment yet. Try the suggestions again." },
      { status: 502 },
    );
  }
}
