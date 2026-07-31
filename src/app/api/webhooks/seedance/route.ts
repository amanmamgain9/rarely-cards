import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { after } from "next/server";
import { hasSeedanceEnv, seedanceEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSeedanceVideo } from "@/lib/video/generation";
import { seedanceCallbackToken } from "@/lib/video/seedance";

const callbackSchema = z.object({
  id: z.string().min(1).max(200),
  status: z.enum([
    "queued",
    "running",
    "succeeded",
    "failed",
    "expired",
    "cancelled",
  ]),
});

export const maxDuration = 60;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export async function POST(request: Request) {
  if (!hasSeedanceEnv()) {
    return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  }
  const searchParams = new URL(request.url).searchParams;
  const generationId = searchParams.get("generationId") || "";
  const provided = searchParams.get("token") || "";
  const validGenerationId = z.string().uuid().safeParse(generationId).success;
  const expected = validGenerationId
    ? seedanceCallbackToken(generationId, seedanceEnv().webhookSecret)
    : "";
  if (!validGenerationId || !timingSafeEqual(digest(provided), digest(expected))) {
    return Response.json({ error: "Invalid webhook token." }, { status: 401 });
  }
  const body = callbackSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  const admin = createAdminClient();
  let { data: row } = await admin
    .from("video_generations")
    .select("id")
    .eq("provider_task_id", body.data.id)
    .maybeSingle();
  if (!row) {
    const mapped = await admin
      .from("video_generations")
      .update({
        provider_task_id: body.data.id,
        status: "running",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", generationId)
      .is("provider_task_id", null)
      .in("status", ["submitting", "failed"])
      .select("id")
      .maybeSingle();
    row = mapped.data;
  }
  if (!row) {
    // A very fast callback can beat persistence of the provider task ID.
    // Returning 503 asks ModelArk to retry delivery.
    return Response.json({ error: "Task is not ready." }, { status: 503 });
  }
  after(() => syncSeedanceVideo(row.id, { force: true }));
  return Response.json({ received: true });
}
