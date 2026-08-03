"use client";

import { useEffect, useState } from "react";
import type { PublicVideoGeneration } from "@/lib/video/types";

export function useVideoGeneration({
  analysisId,
  completed,
  enabled,
  selectedDialogue,
  petName,
}: {
  analysisId: string | null;
  completed: boolean;
  enabled: boolean;
  selectedDialogue: string | null;
  petName: string;
}) {
  const [generation, setGeneration] = useState<PublicVideoGeneration | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageAnalysisId, setMessageAnalysisId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled || !completed || !analysisId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loadVideo = async () => {
      try {
        const response = await fetch(`/api/analyses/${analysisId}/video`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("video_status_failed");
        const payload = (await response.json()) as PublicVideoGeneration | null;
        if (cancelled) return;
        if (!payload && selectedDialogue) {
          const started = await fetch(`/api/analyses/${analysisId}/video`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dialogue: selectedDialogue }),
          });
          const startedPayload = await started.json().catch(() => ({}));
          if (!started.ok) {
            if (started.status === 409) {
              timer = setTimeout(loadVideo, 2_000);
              return;
            }
            throw new Error(startedPayload.error || "video_start_failed");
          }
          if (!cancelled) {
            setGeneration(startedPayload as PublicVideoGeneration);
          }
          timer = setTimeout(loadVideo, 8_000);
          return;
        }
        setGeneration(payload);
        if (payload?.status === "submitting" || payload?.status === "running") {
          timer = setTimeout(loadVideo, 8_000);
        }
      } catch {
        if (!cancelled) {
          setMessageAnalysisId(analysisId);
          setMessage("Video status paused. Refresh to check again.");
        }
      }
    };
    void loadVideo();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [analysisId, completed, enabled, refreshKey, selectedDialogue]);

  async function generate() {
    if (!analysisId || generating) return;
    setGenerating(true);
    setMessageAnalysisId(analysisId);
    setMessage(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/video`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "The video could not start.");
      }
      setGeneration(payload as PublicVideoGeneration);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The video could not start. Try again.",
      );
    } finally {
      setRefreshKey((key) => key + 1);
      setGenerating(false);
    }
  }

  async function share() {
    const visibleGeneration =
      generation?.analysisId === analysisId ? generation : null;
    if (!visibleGeneration?.videoUrl || sharing) return;
    setSharing(true);
    setMessageAnalysisId(analysisId);
    setMessage(null);
    let objectUrl: string | null = null;
    try {
      const response = await fetch(visibleGeneration.videoUrl);
      if (!response.ok) throw new Error("The saved video could not be opened.");
      const blob = await response.blob();
      const petSlug = petName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const file = new File([blob], `rarely-${petSlug || "pet"}.mp4`, {
        type: "video/mp4",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${petName}'s video` });
      } else {
        objectUrl = URL.createObjectURL(blob);
        const download = document.createElement("a");
        download.href = objectUrl;
        download.download = file.name;
        download.click();
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessage(
          error instanceof Error ? error.message : "The video could not be shared.",
        );
      }
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setSharing(false);
    }
  }

  return {
    generation: generation?.analysisId === analysisId ? generation : null,
    generating,
    sharing,
    message: messageAnalysisId === analysisId ? message : null,
    generate,
    share,
  };
}
