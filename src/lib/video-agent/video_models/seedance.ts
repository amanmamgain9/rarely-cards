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

export type SeedanceReference =
  | { type: "image"; url: string }
  | { type: "video"; url: string }
  | { type: "audio"; url: string };

export type SeedanceGeneration = {
  prompt: string;
  firstFrame?: Buffer | string;
  lastFrame?: Buffer | string;
  references?: SeedanceReference[];
  durationSeconds?: number | "auto";
  resolution?: "480p" | "720p" | "1080p" | "4k";
  ratio?: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive";
  generateAudio?: boolean;
  watermark?: boolean;
  returnLastFrame?: boolean;
  priority?: number;
};

function imageUrl(image: Buffer | string) {
  return Buffer.isBuffer(image) ? `data:image/jpeg;base64,${image.toString("base64")}` : image;
}

export function buildSeedanceContent(input: SeedanceGeneration) {
  if (!input.prompt.trim()) throw new Error("seedance_prompt_missing");
  if (input.lastFrame && !input.firstFrame) throw new Error("seedance_last_frame_requires_first_frame");
  if ((input.firstFrame || input.lastFrame) && input.references?.length) throw new Error("seedance_reference_modes_conflict");
  if (input.durationSeconds !== undefined && input.durationSeconds !== "auto"
    && (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 4 || input.durationSeconds > 15)) {
    throw new Error("seedance_duration_invalid");
  }
  if (input.priority !== undefined && (!Number.isInteger(input.priority) || input.priority < 0 || input.priority > 9)) {
    throw new Error("seedance_priority_invalid");
  }

  const references = input.references ?? [];
  if (references.some((reference) => !reference.url.trim())) throw new Error("seedance_reference_url_missing");
  const imageCount = references.filter((reference) => reference.type === "image").length;
  const videoCount = references.filter((reference) => reference.type === "video").length;
  const audioCount = references.filter((reference) => reference.type === "audio").length;
  if (imageCount > 9 || videoCount > 3 || audioCount > 3) throw new Error("seedance_reference_limit_exceeded");
  if (audioCount && !imageCount && !videoCount) throw new Error("seedance_audio_requires_visual_reference");

  return [
    { type: "text", text: input.prompt },
    ...(input.firstFrame ? [{ type: "image_url", role: "first_frame", image_url: { url: imageUrl(input.firstFrame) } }] : []),
    ...(input.lastFrame ? [{ type: "image_url", role: "last_frame", image_url: { url: imageUrl(input.lastFrame) } }] : []),
    ...references.map((reference) => reference.type === "image"
      ? { type: "image_url", role: "reference_image", image_url: { url: reference.url } }
      : reference.type === "video"
        ? { type: "video_url", role: "reference_video", video_url: { url: reference.url } }
        : { type: "audio_url", role: "reference_audio", audio_url: { url: reference.url } }),
  ];
}

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

export async function createSeedanceVideo(input: SeedanceGeneration & {
  userId: string;
  generationId: string;
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
  const body = JSON.stringify({
    model: env.model,
    content: buildSeedanceContent(input),
    ...(input.generateAudio === undefined ? {} : { generate_audio: input.generateAudio }),
    ...(input.resolution ? { resolution: input.resolution } : {}),
    ...(input.ratio ? { ratio: input.ratio } : {}),
    ...(input.durationSeconds === undefined ? {} : { duration: input.durationSeconds === "auto" ? -1 : input.durationSeconds }),
    ...(input.watermark === undefined ? {} : { watermark: input.watermark }),
    ...(input.returnLastFrame === undefined ? {} : { return_last_frame: input.returnLastFrame }),
    ...(input.priority === undefined ? {} : { priority: input.priority }),
    callback_url: `${env.appUrl}/api/webhooks/seedance?generationId=${encodeURIComponent(input.generationId)}&token=${callbackToken}`,
    safety_identifier: safetyIdentifier,
    execution_expires_after: 3600,
  });
  if (Buffer.byteLength(body) > 64 * 1024 * 1024) throw new Error("seedance_request_too_large");
  const payload = await seedanceRequest(TASKS_PATH, {
    method: "POST",
    body,
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
