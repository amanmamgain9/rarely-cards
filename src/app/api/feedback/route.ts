import { productFeedbackSchema } from "@/lib/feedback";
import { requireUser } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { user } = await requireUser();
  if (!user) {
    return Response.json({ error: "Sign in to send feedback." }, { status: 401 });
  }

  const limit = await checkRateLimit({
    request,
    scope: "product-feedback",
    userId: user.id,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const parsed = productFeedbackSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Check your feedback." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (parsed.data.videoId) {
    const { data: video } = await admin
      .from("video_generations")
      .select("id")
      .eq("id", parsed.data.videoId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!video) {
      return Response.json({ error: "That video is unavailable." }, { status: 404 });
    }
  }

  const { error } = await admin.from("product_feedback").insert({
    user_id: user.id,
    video_generation_id: parsed.data.videoId ?? null,
    kind: parsed.data.kind,
    rating:
      parsed.data.kind === "video_experience"
        ? (parsed.data.rating ?? null)
        : null,
    message: parsed.data.message,
  });
  if (error) {
    return Response.json({ error: "Your note could not be sent." }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
