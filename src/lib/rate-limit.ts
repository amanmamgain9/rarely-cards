import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function requestIp(request: Request): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function digest(value: string): string {
  const salt = process.env.RATE_LIMIT_SALT?.trim();
  if (!salt) {
    throw new Error("Missing required environment variable: RATE_LIMIT_SALT");
  }
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

export async function checkRateLimit({
  request,
  scope,
  userId,
  limit,
  windowSeconds,
}: {
  request: Request;
  scope: string;
  userId?: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const identity = userId ? `user:${userId}` : `ip:${digest(requestIp(request))}`;
  const key = `${scope}:${identity}`;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) throw new Error(`rate_limit_unavailable:${error.code}`);
  const row = Array.isArray(data) ? data[0] : data;

  return {
    allowed: Boolean(row?.allowed),
    remaining: Number(row?.remaining ?? 0),
    retryAfterSeconds: Number(row?.retry_after_seconds ?? windowSeconds),
  };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: "Too many requests. Try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

