import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MAX_IMAGE_BYTES } from "@/lib/analysis/image";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const replacementSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES),
});
const extensionForMime = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  const body = replacementSchema.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !body.success) {
    return Response.json({ error: "Invalid replacement photo." }, { status: 400 });
  }

  const limit = await checkRateLimit({
    request,
    scope: "photo-replacement",
    userId: user.id,
    limit: 5,
    windowSeconds: 24 * 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const admin = createAdminClient();
  const { data: analysis } = await admin
    .from("analysis_requests")
    .select("id, user_id, status, replacement_count, object_path, credit_state")
    .eq("id", id)
    .maybeSingle();
  if (!analysis || analysis.user_id !== user.id) {
    return Response.json({ error: "Analysis not found." }, { status: 404 });
  }
  if (analysis.status !== "photo_rejected") {
    return Response.json({ error: "A replacement photo is not expected." }, { status: 409 });
  }
  if (analysis.credit_state === "consumed") {
    return Response.json(
      {
        error:
          "The AI completed this attempt. Start a new card with another credit.",
        startNew: true,
      },
      { status: 409 },
    );
  }
  if (analysis.replacement_count >= 3) {
    return Response.json(
      { error: "Replacement limit reached. Ask for a refund instead." },
      { status: 409 },
    );
  }

  if (analysis.object_path) {
    await admin.storage.from("analysis-photos").remove([analysis.object_path]);
  }
  const replacementNumber = analysis.replacement_count + 1;
  const extension = extensionForMime[body.data.mimeType];
  const objectPath = `${user.id}/${id}/replacement-${replacementNumber}.${extension}`;
  const { data: upload, error: uploadError } = await admin.storage
    .from("analysis-photos")
    .createSignedUploadUrl(objectPath, { upsert: false });
  if (uploadError || !upload) {
    return Response.json({ error: "Could not prepare the replacement." }, { status: 500 });
  }

  const { data: updated, error: updateError } = await admin
    .from("analysis_requests")
    .update({
      status: "awaiting_upload",
      object_path: objectPath,
      image_mime_type: body.data.mimeType,
      image_bytes: body.data.size,
      image_width: null,
      image_height: null,
      replacement_count: replacementNumber,
      rejection_reason: null,
      rejection_message: null,
      error_code: null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", id)
    .eq("status", "photo_rejected")
    .eq("replacement_count", analysis.replacement_count)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    return Response.json({ error: "Replacement state changed. Refresh and retry." }, { status: 409 });
  }

  return Response.json({
    id,
    upload: { path: upload.path, token: upload.token },
  });
}

