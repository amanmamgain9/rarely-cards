import "server-only";

import {
  analysisStatusSchema,
  cardStyleSchema,
  type PublicAnalysis,
} from "@/lib/analysis/types";
import { isResumableAnalysisStatus } from "@/lib/analysis/resume";
import { createAdminClient } from "@/lib/supabase/admin";
import { petDialogueSuggestionsSchema } from "@/lib/video/dialogue";

const resumeAnalysisSelection =
  "id, card_style, experience_kind, pet_name, pet_pronouns, status, rejection_message, replacement_count, created_at, updated_at, object_path, dialogue_suggestions, selected_dialogue, draft_data";

type ResumableAnalysisRow = {
  id: string;
  card_style: string;
  experience_kind: "card" | "talking_video" | "birthday_video" | "movie_scene";
  pet_name: string | null;
  pet_pronouns: "he" | "she" | "they" | null;
  status: string;
  rejection_message: string | null;
  replacement_count: number;
  created_at: string;
  updated_at: string;
  object_path: string | null;
  dialogue_suggestions: unknown;
  selected_dialogue: string | null;
  draft_data: unknown;
};

async function toResumableAnalysis(
  userId: string,
  data: ResumableAnalysisRow | null,
): Promise<PublicAnalysis | null> {
  if (!data) return null;

  let status = analysisStatusSchema.parse(data.status);
  if (!isResumableAnalysisStatus(status)) return null;
  if (status === "awaiting_payment") {
    await createAdminClient()
      .from("analysis_requests")
      .update({ status: "awaiting_name", error_code: null })
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("status", "awaiting_payment");
    status = "awaiting_name";
  }
  if (!data.object_path) return null;

  return {
    id: data.id,
    petName: data.pet_name,
    petPronouns: data.pet_pronouns,
    cardStyle: cardStyleSchema.parse(data.card_style),
    experienceKind: data.experience_kind,
    status,
    result: null,
    rejectionMessage: data.rejection_message,
    replacementCount: data.replacement_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    photoUrl: `/api/analyses/${data.id}/photo`,
    refundState: status === "refund_pending" ? "pending" : "none",
    dialogueSuggestions:
      petDialogueSuggestionsSchema.safeParse(data.dialogue_suggestions).data ?? [],
    selectedDialogue: data.selected_dialogue,
    draftData:
      data.draft_data && typeof data.draft_data === "object" && !Array.isArray(data.draft_data)
        ? data.draft_data as Record<string, unknown>
        : {},
  };
}

export async function getResumableAnalysisById(
  userId: string,
  analysisId: string,
  experienceKind?: "talking_video" | "birthday_video" | "movie_scene",
): Promise<PublicAnalysis | null> {
  const admin = createAdminClient();
  let query = admin
    .from("analysis_requests")
    .select(resumeAnalysisSelection)
    .eq("id", analysisId)
    .eq("user_id", userId)
    .not("photo_uploaded_at", "is", null);
  query = experienceKind
    ? query.eq("experience_kind", experienceKind)
    : query.in("experience_kind", ["talking_video", "birthday_video", "movie_scene"]);
  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(`resume_analysis_unavailable:${error.code}`);
  return toResumableAnalysis(userId, data as ResumableAnalysisRow | null);
}
