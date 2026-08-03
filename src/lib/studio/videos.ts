import "server-only";

import { developmentVideoCreditBalance } from "@/lib/payments/development-credits";
import { createAdminClient } from "@/lib/supabase/admin";
import { DRAFT_ANALYSIS_STATUSES } from "@/lib/analysis/resume";
import type { AnalysisStatus } from "@/lib/analysis/types";

export type StudioVideo = {
  id: string;
  analysisId: string;
  status: "submitting" | "running" | "succeeded";
  petName: string;
  dialogue: string | null;
  createdAt: string;
  completedAt: string | null;
  photoUrl: string;
  videoUrl: string | null;
};

export type StudioDraft = {
  id: string;
  status: AnalysisStatus;
  petName: string | null;
  dialogue: string | null;
  createdAt: string;
  updatedAt: string;
  photoUrl: string;
};

type VideoRow = {
  id: string;
  analysis_id: string;
  status: "submitting" | "running" | "succeeded" | "failed";
  output_path: string | null;
  created_at: string;
  completed_at: string | null;
  discard_requested_at: string | null;
};

type AnalysisRow = {
  id: string;
  pet_name: string | null;
  selected_dialogue: string | null;
  object_path: string | null;
};

function toStudioVideo(
  row: VideoRow,
  analysis: AnalysisRow | undefined,
): StudioVideo {
  return {
    id: row.id,
    analysisId: row.analysis_id,
    status: row.status as StudioVideo["status"],
    petName: analysis?.pet_name?.trim() || "My pet",
    dialogue: analysis?.selected_dialogue ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    photoUrl: `/api/analyses/${row.analysis_id}/photo`,
    videoUrl:
      row.status === "succeeded" && row.output_path
        ? `/api/analyses/${row.analysis_id}/video/file`
        : null,
  };
}

async function analysesById(userId: string, analysisIds: string[]) {
  if (analysisIds.length === 0) return new Map<string, AnalysisRow>();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("analysis_requests")
    .select("id, pet_name, selected_dialogue, object_path")
    .eq("user_id", userId)
    .in("id", analysisIds);
  if (error) throw new Error(`studio_analyses_unavailable:${error.code}`);
  return new Map((data ?? []).map((analysis) => [analysis.id, analysis]));
}

export async function getStudioVideos(userId: string): Promise<StudioVideo[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("video_generations")
    .select(
      "id, analysis_id, status, output_path, created_at, completed_at, discard_requested_at",
    )
    .eq("user_id", userId)
    .in("status", ["submitting", "running", "succeeded"])
    .is("discard_requested_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`studio_videos_unavailable:${error.code}`);

  const rows = (data ?? []) as VideoRow[];
  const analyses = await analysesById(
    userId,
    rows.map((row) => row.analysis_id),
  );
  return rows.map((row) => toStudioVideo(row, analyses.get(row.analysis_id)));
}

export async function getStudioDrafts(userId: string): Promise<StudioDraft[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("analysis_requests")
    .select("id, status, pet_name, selected_dialogue, created_at, updated_at")
    .eq("user_id", userId)
    .eq("experience_kind", "talking_video")
    .in("status", [...DRAFT_ANALYSIS_STATUSES])
    .not("object_path", "is", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`studio_drafts_unavailable:${error.code}`);

  return (data ?? []).map((draft) => ({
    id: draft.id,
    status: draft.status as AnalysisStatus,
    petName: draft.pet_name,
    dialogue: draft.selected_dialogue,
    createdAt: draft.created_at,
    updatedAt: draft.updated_at,
    photoUrl: `/api/analyses/${draft.id}/photo`,
  }));
}

export async function getStudioVideo(
  userId: string,
  videoId: string,
): Promise<StudioVideo | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("video_generations")
    .select(
      "id, analysis_id, status, output_path, created_at, completed_at, discard_requested_at",
    )
    .eq("id", videoId)
    .eq("user_id", userId)
    .in("status", ["submitting", "running", "succeeded"])
    .is("discard_requested_at", null)
    .maybeSingle();
  if (error) throw new Error(`studio_video_unavailable:${error.code}`);
  if (!data) return null;

  const row = data as VideoRow;
  const analyses = await analysesById(userId, [row.analysis_id]);
  return toStudioVideo(row, analyses.get(row.analysis_id));
}

export async function getStudioCreditBalance(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("credit_purchases")
    .select("credits_remaining")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("credit_kind", "talking_video");
  if (error) throw new Error(`studio_credits_unavailable:${error.code}`);
  return developmentVideoCreditBalance(
    (data ?? []).reduce(
      (total, purchase) => total + purchase.credits_remaining,
      0,
    ),
  );
}
