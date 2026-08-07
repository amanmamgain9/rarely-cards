import "server-only";

import { randomUUID } from "node:crypto";
import {
  cancelOrDeleteSeedanceVideo,
  getSeedanceVideo,
} from "@/lib/video/seedance";
import { reportServerError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicVideoGeneration } from "@/lib/video/types";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_REDIRECTS = 3;
const TRUSTED_VIDEO_HOST_SUFFIXES = [
  "byteplus.com",
  "bytepluses.com",
  "volces.com",
  "volccdn.com",
] as const;

function isTrustedVideoUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      TRUSTED_VIDEO_HOST_SUFFIXES.some(
        (suffix) =>
          url.hostname === suffix || url.hostname.endsWith(`.${suffix}`),
      )
    );
  } catch {
    return false;
  }
}

async function fetchTrustedVideo(value: string) {
  let current = value;
  for (let redirect = 0; redirect <= MAX_VIDEO_REDIRECTS; redirect += 1) {
    if (!isTrustedVideoUrl(current)) {
      throw new Error("seedance_untrusted_video_url");
    }
    const response = await fetch(current, {
      cache: "no-store",
      redirect: "manual",
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location || redirect === MAX_VIDEO_REDIRECTS) {
      throw new Error("seedance_video_redirect_invalid");
    }
    current = new URL(location, current).toString();
  }
  throw new Error("seedance_video_redirect_invalid");
}

async function readBoundedVideo(response: Response) {
  if (!response.body) throw new Error("seedance_video_invalid_size");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_VIDEO_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("seedance_video_too_large");
    }
    chunks.push(value);
  }
  if (totalBytes === 0) throw new Error("seedance_video_invalid_size");
  return Buffer.concat(chunks, totalBytes);
}

function usageCostFields(
  totalTokens: number | null,
  usdPerMillionTokens: number | null,
) {
  return {
    usage_total_tokens: totalTokens,
    estimated_cost_usd_micros:
      totalTokens !== null && usdPerMillionTokens !== null
        ? Math.round(totalTokens * usdPerMillionTokens)
        : null,
  };
}

type VideoRow = {
  id: string;
  analysis_id: string;
  user_id: string;
  status: "submitting" | "running" | "succeeded" | "failed";
  provider_task_id: string | null;
  output_path: string | null;
  discard_requested_at?: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
};

export async function toPublicVideoGeneration(
  row: VideoRow,
): Promise<PublicVideoGeneration> {
  return {
    id: row.id,
    analysisId: row.analysis_id,
    status: row.status,
    videoUrl:
      row.status === "succeeded" && row.output_path
        ? `/api/analyses/${row.analysis_id}/video/file`
        : null,
    canRetry:
      row.status === "failed" &&
      row.attempt_count < 3 &&
      !row.discard_requested_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeProviderCode(error: unknown) {
  if (error instanceof Error && /^seedance_[a-z0-9_]+$/i.test(error.message)) {
    return error.message.slice(0, 120);
  }
  return "seedance_sync_failed";
}

function isTerminalSyncFailure(code: string) {
  const httpStatus = /^seedance_http_(\d{3})$/.exec(code)?.[1];
  const downloadHttpStatus =
    /^seedance_download_http_(\d{3})$/.exec(code)?.[1];
  const numericStatus = httpStatus
    ? Number(httpStatus)
    : downloadHttpStatus
      ? Number(downloadHttpStatus)
      : null;
  return (
    [
      "seedance_missing_video_url",
      "seedance_video_too_large",
      "seedance_video_invalid_size",
      "seedance_video_invalid_content_type",
      "seedance_video_invalid_container",
      "seedance_untrusted_video_url",
      "seedance_video_redirect_invalid",
    ].includes(code) ||
    (numericStatus !== null &&
      numericStatus >= 400 &&
      numericStatus < 500 &&
      ![408, 409, 429].includes(numericStatus))
  );
}

export async function syncSeedanceVideo(
  videoId: string,
  options: { force?: boolean } = {},
) {
  const admin = createAdminClient();
  const markProviderDiscarded = async (id: string) => {
    // Retain the local tombstone permanently. Besides proving cleanup, it is
    // the durable marker that a delivered video must never refund its credit.
    await admin
      .from("video_generations")
      .update({
        status: "failed",
        provider_task_id: null,
        output_path: null,
        error_code: "discarded_by_user",
        sync_token: null,
        sync_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  };
  const { data: candidate } = await admin
    .from("video_generations")
    .select(
      "id, analysis_id, user_id, status, provider_task_id, output_path, attempt_count, created_at, updated_at, submitted_at, discard_requested_at, last_synced_at, pricing_usd_per_million_tokens",
    )
    .eq("id", videoId)
    .maybeSingle();
  if (!candidate || !candidate.provider_task_id) return;

  if (candidate.discard_requested_at && candidate.status !== "running") {
    if (await cancelOrDeleteSeedanceVideo(candidate.provider_task_id)) {
      await markProviderDiscarded(candidate.id);
    }
    return;
  }
  if (candidate.status !== "running") return;

  if (
    !options.force &&
    candidate.last_synced_at &&
    Date.now() - new Date(candidate.last_synced_at).getTime() < 8_000
  ) {
    return;
  }
  const syncToken = randomUUID();
  const staleLease = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: row } = await admin
    .from("video_generations")
    .update({
      last_synced_at: new Date().toISOString(),
      sync_token: syncToken,
      sync_started_at: new Date().toISOString(),
    })
    .eq("id", candidate.id)
    .eq("status", "running")
    .or(`sync_token.is.null,sync_started_at.lt.${staleLease}`)
    .select(
      "id, analysis_id, user_id, status, provider_task_id, output_path, attempt_count, created_at, updated_at, discard_requested_at, last_synced_at, pricing_usd_per_million_tokens",
    )
    .maybeSingle();
  if (!row?.provider_task_id) return;

  try {
    const task = await getSeedanceVideo(row.provider_task_id);
    if (task.status === "queued" || task.status === "running") {
      if (
        row.discard_requested_at &&
        (await cancelOrDeleteSeedanceVideo(row.provider_task_id))
      ) {
        await markProviderDiscarded(row.id);
        return;
      }
      await admin
        .from("video_generations")
        .update({
          ...usageCostFields(
            task.usageTotalTokens,
            row.pricing_usd_per_million_tokens,
          ),
          sync_token: null,
          sync_started_at: null,
        })
        .eq("id", row.id)
        .eq("status", "running")
        .eq("sync_token", syncToken);
      return;
    }
    if (
      task.status === "failed" ||
      task.status === "expired" ||
      task.status === "cancelled"
    ) {
      if (row.discard_requested_at) {
        if (
          task.status === "cancelled" ||
          (await cancelOrDeleteSeedanceVideo(row.provider_task_id))
        ) {
          await markProviderDiscarded(row.id);
        } else {
          await admin
            .from("video_generations")
            .update({ sync_token: null, sync_started_at: null })
            .eq("id", row.id)
            .eq("sync_token", syncToken);
        }
        return;
      }
      await admin
        .from("video_generations")
        .update({
          status: "failed",
          error_code: task.errorCode || `seedance_${task.status}`,
          ...usageCostFields(
            task.usageTotalTokens,
            row.pricing_usd_per_million_tokens,
          ),
          sync_token: null,
          sync_started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "running")
        .eq("sync_token", syncToken)
        .select("analysis_id")
        .maybeSingle();
      return;
    }
    if (!task.videoUrl) throw new Error("seedance_missing_video_url");

    if (row.discard_requested_at) {
      if (await cancelOrDeleteSeedanceVideo(row.provider_task_id)) {
        await markProviderDiscarded(row.id);
      } else {
        await admin
          .from("video_generations")
          .update({ sync_token: null, sync_started_at: null })
          .eq("id", row.id)
          .eq("sync_token", syncToken);
      }
      return;
    }

    const response = await fetchTrustedVideo(task.videoUrl);
    if (!response.ok) throw new Error(`seedance_download_http_${response.status}`);
    const contentType = response.headers.get("content-type")?.split(";", 1)[0];
    if (
      contentType !== "video/mp4" &&
      contentType !== "application/octet-stream"
    ) {
      throw new Error("seedance_video_invalid_content_type");
    }
    const declaredBytes = Number(response.headers.get("content-length") || 0);
    if (declaredBytes > MAX_VIDEO_BYTES) {
      throw new Error("seedance_video_too_large");
    }
    const video = await readBoundedVideo(response);
    if (video.length < 12 || video.subarray(4, 8).toString("ascii") !== "ftyp") {
      throw new Error("seedance_video_invalid_container");
    }

    const outputPath = `${row.user_id}/${row.analysis_id}/seedance.mp4`;
    const { error: uploadError } = await admin.storage
      .from("generated-videos")
      .upload(outputPath, video, {
        contentType: "video/mp4",
        cacheControl: "3600",
        upsert: true,
      });
    if (uploadError) throw new Error("seedance_video_store_failed");

    const { data: finalized, error: finalizeError } = await admin
      .from("video_generations")
      .update({
        status: "succeeded",
        output_path: outputPath,
        error_code: null,
        ...usageCostFields(
          task.usageTotalTokens,
          row.pricing_usd_per_million_tokens,
        ),
        completed_at: new Date().toISOString(),
        sync_token: null,
        sync_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "running")
      .eq("sync_token", syncToken)
      .is("discard_requested_at", null)
      .select("id")
      .maybeSingle();
    if (finalizeError || !finalized) {
      // Deletion may win while the provider download is in flight. Never
      // retain an MP4 that no longer has an owning database row.
      await admin.storage.from("generated-videos").remove([outputPath]);
      if (finalizeError) throw new Error("seedance_video_finalize_failed");
    }
  } catch (error) {
    const code = safeProviderCode(error);
    reportServerError(error, {
      operation: "seedance_video_sync",
      analysisId: row.analysis_id,
      attempt: row.attempt_count,
      code,
    });
    await admin
      .from("video_generations")
      .update({
        // Provider, network, and storage outages are retried by the webhook,
        // result screen, or account reconciliation without buying a new task.
        status: isTerminalSyncFailure(code) ? "failed" : "running",
        error_code: code,
        sync_token: null,
        sync_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "running")
      .eq("sync_token", syncToken)
      .select("analysis_id, status")
      .maybeSingle();
  }
}
