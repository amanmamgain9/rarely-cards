"use client";

import { useCallback, useEffect, useState } from "react";
import type { PetDialogueSuggestion } from "@/lib/video/dialogue";

export function useDialogueSuggestions({
  analysisId,
  enabled,
  initialSuggestions,
  initialSelectedDialogue,
  initiallyBusy,
  onRejected,
  onMessage,
  onRefresh,
}: {
  analysisId: string | null;
  enabled: boolean;
  initialSuggestions: PetDialogueSuggestion[];
  initialSelectedDialogue: string;
  initiallyBusy: boolean;
  onRejected: () => void;
  onMessage: (message: string | null) => void;
  onRefresh: () => unknown | Promise<unknown>;
}) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [selected, setSelected] = useState(initialSelectedDialogue);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(initiallyBusy);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !analysisId || suggestions.length > 0) return;
    let cancelled = false;
    void fetch(`/api/analyses/${analysisId}/dialogue`, { method: "POST" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Suggestions could not be made.");
        }
        if (payload.status === "rejected") {
          if (!cancelled) {
            setSuggestions([]);
            setSelected("");
            onMessage(payload.message || "Choose a clearer photo of one cat or dog.");
            onRejected();
            void onRefresh();
          }
          return;
        }
        if (!cancelled) {
          setSuggestions(payload.suggestions);
          setSelected(payload.suggestions[0]?.line ?? "");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          onMessage(error instanceof Error ? error.message : "Suggestions could not be made.");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId, attempt, enabled, onMessage, onRefresh, onRejected, suggestions.length]);

  const select = useCallback((line: string) => {
    setSelected(line);
    setCustom("");
  }, []);
  const writeCustom = useCallback((line: string) => {
    setCustom(line);
    if (line) setSelected("");
  }, []);
  const retry = useCallback(() => {
    onMessage(null);
    setBusy(true);
    setAttempt((current) => current + 1);
  }, [onMessage]);
  const reset = useCallback((options?: { busy?: boolean }) => {
    setSuggestions([]);
    setSelected("");
    setCustom("");
    setBusy(options?.busy ?? false);
  }, []);

  return {
    suggestions,
    selected,
    custom,
    busy,
    select,
    writeCustom,
    retry,
    reset,
    setSelected,
  };
}
