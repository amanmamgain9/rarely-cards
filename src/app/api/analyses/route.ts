import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MAX_IMAGE_BYTES } from "@/lib/analysis/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const createAnalysisSchema = z.object({
  cardStyle: z.literal("pet"),
  experienceKind: z.literal("talking_video"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES),
});

const extensionForMime = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const limit = await checkRateLimit({
    request,
    scope: "analysis-create",
    userId: user.id,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const parsed = createAnalysisSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid photo metadata." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: analysis, error: insertError } = await admin
    .from("analysis_requests")
    .insert({
      user_id: user.id,
      card_style: parsed.data.cardStyle,
      experience_kind: parsed.data.experienceKind,
      status: "awaiting_upload",
    })
    .select("id")
    .single();

  if (insertError || !analysis) {
    return Response.json({ error: "Could not start the analysis." }, { status: 500 });
  }

  const extension = extensionForMime[parsed.data.mimeType];
  const objectPath = `${user.id}/${analysis.id}/original.${extension}`;
  const { data: signedUpload, error: signedUploadError } = await admin.storage
    .from("analysis-photos")
    .createSignedUploadUrl(objectPath, { upsert: false });

  if (signedUploadError || !signedUpload) {
    await admin.from("analysis_requests").delete().eq("id", analysis.id);
    return Response.json({ error: "Could not prepare the upload." }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("analysis_requests")
    .update({
      object_path: objectPath,
      image_mime_type: parsed.data.mimeType,
      image_bytes: parsed.data.size,
    })
    .eq("id", analysis.id)
    .eq("status", "awaiting_upload");

  if (updateError) {
    await admin.storage.from("analysis-photos").remove([objectPath]);
    await admin.from("analysis_requests").delete().eq("id", analysis.id);
    return Response.json({ error: "Could not prepare the analysis." }, { status: 500 });
  }

  return Response.json(
    {
      id: analysis.id,
      upload: {
        path: signedUpload.path,
        token: signedUpload.token,
      },
    },
    { status: 201 },
  );
}
