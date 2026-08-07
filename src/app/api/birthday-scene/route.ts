import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  inspectImage,
  prepareBirthdaySceneForUpload,
  prepareImageForGemini,
} from "@/lib/analysis/image";
import { storeGeneratedScene } from "@/lib/analysis/generated-scene";
import { generateBirthdayScene } from "@/lib/ai/gemini";
import {
  buildBirthdayScenePrompt,
  MAX_BIRTHDAY_PETS,
  MIN_BIRTHDAY_PETS,
} from "@/lib/birthday/prompt";
import { reportServerError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { petVoiceAccentSchema } from "@/lib/video/accent";
import { petDialogueSchema } from "@/lib/video/dialogue";

export const maxDuration = 60;

const recipientSchema = z.string().trim().min(1).max(40);
const draftIdSchema = z.string().uuid();
const saveSchema = z.object({
  analysisId: z.string().uuid(),
  recipientName: recipientSchema,
  greeting: petDialogueSchema,
  voiceAccent: petVoiceAccentSchema,
});

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return Response.json(
      { error: "Birthday portraits are temporarily unavailable." },
      { status: 503 },
    );
  }
  const limit = await checkRateLimit({
    request,
    scope: "birthday-scene-create",
    userId: user.id,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const form = await request.formData().catch(() => null);
  const recipientName = recipientSchema.safeParse(form?.get("recipientName"));
  const clientFlow = form?.get("clientFlow") === "stored-preview-v1"
    ? "stored-preview-v1"
    : "legacy";
  const requestedDraftId = form?.get("draftId");
  const greeting = petDialogueSchema.safeParse(form?.get("greeting")).data ?? null;
  const voiceAccent = petVoiceAccentSchema.safeParse(form?.get("voiceAccent")).data ?? "english";
  const draftId = requestedDraftId
    ? draftIdSchema.safeParse(requestedDraftId)
    : null;
  const files = form
    ?.getAll("pets")
    .filter((entry): entry is File => entry instanceof File) ?? [];
  if (
    !recipientName.success ||
    (draftId !== null && !draftId.success) ||
    files.length < MIN_BIRTHDAY_PETS ||
    files.length > MAX_BIRTHDAY_PETS
  ) {
    return Response.json(
      { error: "Add 1–6 pet photos and a birthday name." },
      { status: 400 },
    );
  }

  try {
    const images = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        await inspectImage(buffer);
        return prepareImageForGemini(buffer);
      }),
    );
    const generated = await generateBirthdayScene({
      images,
      prompt: buildBirthdayScenePrompt({
        recipientName: recipientName.data,
        petCount: images.length,
      }),
    });
    const jpeg = await prepareBirthdaySceneForUpload(generated);
    const admin = createAdminClient();
    let analysisId = draftId?.data ?? null;
    let createdDraft = false;
    let previousObjectPath: string | null = null;

    if (analysisId) {
      const { data: existingDraft, error: existingDraftError } = await admin
        .from("analysis_requests")
        .select("id, object_path")
        .eq("id", analysisId)
        .eq("user_id", user.id)
        .eq("experience_kind", "birthday_video")
        .in("status", ["awaiting_name", "awaiting_payment"])
        .is("credit_state", null)
        .maybeSingle();
      if (existingDraftError || !existingDraft) {
        return Response.json(
          { error: "That birthday draft can no longer be replaced." },
          { status: 409 },
        );
      }
      previousObjectPath = existingDraft.object_path;
    } else {
      const { data: created, error: createError } = await admin
        .from("analysis_requests")
        .insert({
          user_id: user.id,
          card_style: "pet",
          experience_kind: "birthday_video",
          pet_name: recipientName.data,
          status: "awaiting_upload",
        })
        .select("id")
        .single();
      if (createError || !created) throw new Error("birthday_draft_create_failed");
      analysisId = created.id;
      createdDraft = true;
    }

    const objectPath = `${user.id}/${analysisId}/portrait-${requestId}.jpg`;
    const storage = admin.storage.from("analysis-photos");
    try {
      await storeGeneratedScene(objectPath, jpeg);
    } catch (error) {
      if (createdDraft) {
        await admin.from("analysis_requests").delete().eq("id", analysisId);
      }
      throw error;
    }

    const { error: updateError } = await admin
      .from("analysis_requests")
      .update({
        pet_name: recipientName.data,
        selected_dialogue: greeting,
        draft_data: { voiceAccent },
        status: "awaiting_name",
        object_path: objectPath,
        image_mime_type: "image/jpeg",
        image_bytes: jpeg.byteLength,
        image_width: 1152,
        image_height: 2048,
        photo_uploaded_at: new Date().toISOString(),
        expires_at: null,
        rejection_reason: null,
        rejection_message: null,
      })
      .eq("id", analysisId)
      .eq("user_id", user.id);
    if (updateError) {
      await storage.remove([objectPath]);
      if (createdDraft) {
        await admin.from("analysis_requests").delete().eq("id", analysisId);
      }
      throw new Error(`birthday_draft_update_failed:${updateError.message}`);
    }

    if (previousObjectPath && previousObjectPath !== objectPath) {
      const { error: previousRemoveError } = await storage.remove([
        previousObjectPath,
      ]);
      if (previousRemoveError) {
        console.warn(
          JSON.stringify({
            event: "birthday_previous_portrait_cleanup_failed",
            requestId,
            analysisId,
            storageCode: previousRemoveError.name,
          }),
        );
      }
    }

    console.info(
      JSON.stringify({
        event: "birthday_scene_created",
        requestId,
        analysisId,
        petCount: images.length,
        outputBytes: jpeg.byteLength,
        durationMs: Date.now() - startedAt,
        clientFlow,
      }),
    );

    return Response.json({
      id: analysisId,
      previewUrl: `/api/analyses/${analysisId}/photo?v=${requestId}`,
    }, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    reportServerError(error, { operation: "birthday_scene_create", code: requestId });
    const invalidImage =
      error instanceof Error &&
      /invalid_image|unsupported_image/.test(error.message);
    return Response.json(
      {
        error: invalidImage
          ? "One of those photos cannot be read. Use a clear JPEG, PNG, or WebP."
          : "The birthday portrait could not be created. Try those photos again.",
      },
      { status: invalidImage ? 422 : 502 },
    );
  }
}

export async function PATCH(request: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = saveSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Birthday draft details are invalid." }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("analysis_requests")
    .update({
      pet_name: body.data.recipientName,
      selected_dialogue: body.data.greeting,
      draft_data: { voiceAccent: body.data.voiceAccent },
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.data.analysisId)
    .eq("user_id", user.id)
    .eq("experience_kind", "birthday_video")
    .in("status", ["awaiting_name", "awaiting_payment"])
    .select("id")
    .maybeSingle();
  if (error || !data) return Response.json({ error: "Birthday draft could not be saved." }, { status: 409 });
  return Response.json({ saved: true });
}
