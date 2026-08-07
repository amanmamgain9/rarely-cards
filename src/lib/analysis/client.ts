"use client";

import type { CardStyle } from "@/lib/analysis/types";

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/client");
  return createClient();
}

async function responsePayload(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export async function createAnalysisFromPhoto(input: {
  file: File;
  cardStyle: CardStyle;
  experienceKind?: "talking_video" | "birthday_video" | "movie_scene";
  petName?: string;
}) {
  const response = await fetch("/api/analyses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cardStyle: input.cardStyle,
      experienceKind: input.experienceKind ?? "talking_video",
      mimeType: input.file.type,
      size: input.file.size,
      petName: input.petName,
    }),
  });
  const created = await responsePayload(response);
  if (!response.ok) {
    throw new Error(String(created.error || "Could not start the upload."));
  }

  const id = String(created.id);
  const upload = created.upload as { path: string; token: string };
  const supabase = await getSupabaseClient();
  const { error } = await supabase.storage
    .from("analysis-photos")
    .uploadToSignedUrl(upload.path, upload.token, input.file, {
      contentType: input.file.type,
    });
  if (error) throw new Error("The photo upload failed. Please try again.");

  const confirmation = await fetch(`/api/analyses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "upload_complete" }),
  });
  const confirmed = await responsePayload(confirmation);
  if (!confirmation.ok) {
    throw new Error(String(confirmed.error || "The photo could not be verified."));
  }

  return { id, status: String(confirmed.status) };
}
