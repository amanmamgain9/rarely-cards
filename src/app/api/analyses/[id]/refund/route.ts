import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { startFullRefund } from "@/lib/paddle";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return Response.json({ error: "Invalid analysis." }, { status: 400 });
  }

  const limit = await checkRateLimit({
    request,
    scope: "refund-create",
    userId: user.id,
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const admin = createAdminClient();
  const { data: analysis } = await admin
    .from("analysis_requests")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!analysis || analysis.user_id !== user.id) {
    return Response.json({ error: "Analysis not found." }, { status: 404 });
  }
  if (
    ![
      "awaiting_name",
      "paid",
      "photo_rejected",
      "failed",
      "refund_pending",
    ].includes(analysis.status)
  ) {
    return Response.json({ error: "This purchase cannot be refunded." }, { status: 409 });
  }

  try {
    const adjustmentId = await startFullRefund(
      id,
      "Customer canceled the Rarely analysis entitlement",
    );
    return Response.json({
      status: "refund_pending",
      adjustmentId,
      message: "Refund started. Paddle may need to approve it before funds are returned.",
    });
  } catch {
    return Response.json(
      { error: "Refund could not be started. Please contact support." },
      { status: 502 },
    );
  }
}

