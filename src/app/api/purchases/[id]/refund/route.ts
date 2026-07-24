import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { startCreditPurchaseRefund } from "@/lib/payments/refunds";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { user } = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const limit = await checkRateLimit({
    request,
    scope: "credit-refund",
    userId: user.id,
    limit: 3,
    windowSeconds: 24 * 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return Response.json({ error: "Invalid purchase." }, { status: 400 });
  }

  try {
    const refund = await startCreditPurchaseRefund(id, user.id);
    return Response.json({
      ...refund,
      message:
        refund.status === "refunded"
          ? "Your full refund was approved."
          : "Your full refund was requested. Your payment provider will email you when it is approved.",
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "refund_failed";
    if (code === "refund_purchase_not_found") {
      return Response.json({ error: "Purchase not found." }, { status: 404 });
    }
    if (code === "refund_window_closed") {
      return Response.json(
        { error: "The 14-day refund window has ended." },
        { status: 409 },
      );
    }
    if (["refund_not_allowed", "refund_state_conflict"].includes(code)) {
      return Response.json(
        { error: "This purchase cannot be refunded right now." },
        { status: 409 },
      );
    }
    return Response.json(
      { error: "Refund could not be started. Contact amanmamgain9@gmail.com." },
      { status: 502 },
    );
  }
}
