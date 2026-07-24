import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { inspectImage, MAX_IMAGE_BYTES } from "@/lib/analysis/image";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  buildZazzlePrintUrl,
  isZazzlePrintEnabled,
  zazzlePrintEnv,
} from "@/lib/printing/zazzle";
import { createAdminClient } from "@/lib/supabase/admin";

const analysisIdSchema = z.string().uuid();
const PRINT_LINK_TTL_SECONDS = 24 * 60 * 60;

export async function POST(request: Request) {
  if (!isZazzlePrintEnabled()) {
    return Response.json({ error: "Print ordering is unavailable." }, { status: 404 });
  }

  const { user, supabase } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const limit = await checkRateLimit({
    request,
    scope: "zazzle-print-link",
    userId: user.id,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const formData = await request.formData().catch(() => null);
  const rawAnalysisId = formData?.get("analysisId");
  const card = formData?.get("card");
  const parsedAnalysisId = analysisIdSchema.safeParse(rawAnalysisId);

  if (!parsedAnalysisId.success || !(card instanceof File)) {
    return Response.json({ error: "Invalid print request." }, { status: 400 });
  }
  if (
    card.type !== "image/png" ||
    card.size === 0 ||
    card.size > MAX_IMAGE_BYTES
  ) {
    return Response.json({ error: "Invalid print image." }, { status: 400 });
  }

  const { data: analysis, error: analysisError } = await supabase
    .from("analysis_requests")
    .select("id, status")
    .eq("id", parsedAnalysisId.data)
    .eq("user_id", user.id)
    .single();

  if (analysisError || !analysis || analysis.status !== "completed") {
    return Response.json({ error: "Completed card not found." }, { status: 404 });
  }

  const buffer = Buffer.from(await card.arrayBuffer());
  try {
    const image = await inspectImage(buffer);
    if (image.mimeType !== "image/png" || image.width < 1000 || image.height < 1000) {
      return Response.json(
        { error: "The print image is not large enough." },
        { status: 400 },
      );
    }
  } catch {
    return Response.json({ error: "Invalid print image." }, { status: 400 });
  }

  const admin = createAdminClient();
  const objectPath = `${user.id}/${analysis.id}/zazzle-card.png`;
  const { error: uploadError } = await admin.storage
    .from("analysis-photos")
    .upload(objectPath, buffer, {
      cacheControl: "3600",
      contentType: "image/png",
      upsert: true,
    });

  if (uploadError) {
    return Response.json(
      { error: "The print image could not be prepared." },
      { status: 500 },
    );
  }

  const { data: signedImage, error: signedImageError } = await admin.storage
    .from("analysis-photos")
    .createSignedUrl(objectPath, PRINT_LINK_TTL_SECONDS);

  if (signedImageError || !signedImage?.signedUrl) {
    return Response.json(
      { error: "The print checkout could not be prepared." },
      { status: 500 },
    );
  }

  const config = zazzlePrintEnv();
  const checkoutUrl = buildZazzlePrintUrl({
    ...config,
    imageUrl: signedImage.signedUrl,
    imageCode: analysis.id,
  });

  return Response.json(
    { checkoutUrl },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
