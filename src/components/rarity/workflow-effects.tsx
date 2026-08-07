"use client";

import { useEffect } from "react";
import type { PublicAnalysis } from "@/lib/analysis/types";
import {
  clearPendingPhoto,
  loadPendingPhoto,
  type PendingPhoto,
} from "@/lib/analysis/pending-photo";
import { clearResumeQuery, setPendingPhotoHint } from "@/components/rarity/rarity-model";

export function PendingPhotoResume({
  enabled,
  initialAnalysis,
  onMissing,
  onRestore,
  onError,
}: {
  enabled: boolean;
  initialAnalysis: PublicAnalysis | null;
  onMissing: () => void;
  onRestore: (pending: PendingPhoto) => Promise<void>;
  onError: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;
    if (initialAnalysis) {
      setPendingPhotoHint(false);
      clearResumeQuery();
      void clearPendingPhoto().catch(() => undefined);
      return;
    }

    let cancelled = false;
    void loadPendingPhoto()
      .then(async (pending) => {
        if (cancelled) return;
        if (!pending) {
          setPendingPhotoHint(false);
          clearResumeQuery();
          onMissing();
          return;
        }
        await onRestore(pending);
      })
      .catch(() => {
        if (!cancelled) onError();
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, initialAnalysis, onError, onMissing, onRestore]);

  return null;
}
