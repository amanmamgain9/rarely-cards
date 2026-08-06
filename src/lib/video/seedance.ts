import "server-only";

import { createHash, createHmac } from "node:crypto";
import { seedanceEnv } from "@/lib/env";

const TASKS_PATH = "/api/v3/contents/generations/tasks";

export function seedanceCallbackToken(generationId: string, secret: string) {
  return createHmac("sha256", secret).update(generationId).digest("hex");
}

type SeedanceTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "expired"
  | "cancelled";

export type SeedanceTask = {
  id: string;
  status: SeedanceTaskStatus;
  videoUrl: string | null;
  errorCode: string | null;
  usageTotalTokens: number | null;
};

async function seedanceRequest(path: string, init?: RequestInit) {
  const env = seedanceEnv();
  const response = await fetch(`${env.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!response.ok) {
    // Keep the HTTP status machine-readable. ModelArk symbolic codes may
    // contain punctuation and are not needed in persisted application state.
    throw new Error(`seedance_http_${response.status}`);
  }
  if (!payload) throw new Error("seedance_invalid_response");
  return payload;
}

export async function createSeedanceVideo(input: {
  image: Buffer;
  prompt: string;
  userId: string;
  generationId: string;
  durationSeconds?: 8 | 10;
}) {
  const env = seedanceEnv();
  const safetyIdentifier = createHash("sha256")
    .update(input.userId)
    .digest("hex")
    .slice(0, 32);
  const callbackToken = seedanceCallbackToken(
    input.generationId,
    env.webhookSecret,
  );
  const payload = await seedanceRequest(TASKS_PATH, {
    method: "POST",
    body: JSON.stringify({
      model: env.model,
      content: [
        { type: "text", text: input.prompt },
        {
          type: "image_url",
          role: "first_frame",
          image_url: {
            url: `data:image/jpeg;base64,${input.image.toString("base64")}`,
          },
        },
      ],
      generate_audio: true,
      resolution: "720p",
      ratio: "9:16",
      duration: input.durationSeconds ?? 8,
      watermark: false,
      callback_url: `${env.appUrl}/api/webhooks/seedance?generationId=${encodeURIComponent(input.generationId)}&token=${callbackToken}`,
      safety_identifier: safetyIdentifier,
      execution_expires_after: 3600,
    }),
  });
  if (typeof payload.id !== "string" || !payload.id) {
    throw new Error("seedance_missing_task_id");
  }
  return payload.id;
}

export async function getSeedanceVideo(taskId: string): Promise<SeedanceTask> {
  const payload = await seedanceRequest(
    `${TASKS_PATH}/${encodeURIComponent(taskId)}`,
  );
  const status = payload.status;
  if (
    status !== "queued" &&
    status !== "running" &&
    status !== "succeeded" &&
    status !== "failed" &&
    status !== "expired" &&
    status !== "cancelled"
  ) {
    throw new Error("seedance_invalid_task_status");
  }
  const content =
    payload.content && typeof payload.content === "object"
      ? (payload.content as Record<string, unknown>)
      : null;
  const error =
    payload.error && typeof payload.error === "object"
      ? (payload.error as Record<string, unknown>)
      : null;
  const usage =
    payload.usage && typeof payload.usage === "object"
      ? (payload.usage as Record<string, unknown>)
      : null;
  return {
    id: String(payload.id || taskId),
    status,
    videoUrl:
      content && typeof content.video_url === "string"
        ? content.video_url
        : null,
    errorCode: error ? String(error.code || "provider_failed") : null,
    usageTotalTokens:
      usage && Number.isSafeInteger(Number(usage.total_tokens))
        ? Number(usage.total_tokens)
        : null,
  };
}

export async function cancelOrDeleteSeedanceVideo(taskId: string) {
  try {
    await seedanceRequest(`${TASKS_PATH}/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
    });
    return true;
  } catch {
    // ModelArk cannot cancel a task once it is actively running. The caller
    // keeps a tombstone mapping and retries deletion after it becomes terminal.
    return false;
  }
}
