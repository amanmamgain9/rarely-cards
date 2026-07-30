"use client";

import { useEffect, useRef } from "react";
import type { PublicAnalysis } from "@/lib/analysis/types";
import {
  clearPendingPhoto,
  loadPendingPhoto,
  type PendingPhoto,
} from "@/lib/pending-photo";
import { restoreGooglePlayPurchases } from "@/lib/payments/google-play-client";
import type { PaymentChannel } from "@/lib/payments/use-payment-channel";
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

export function GooglePlayPurchaseRestorer({
  channel,
  enabled,
  analysisId,
  onRestored,
}: {
  channel: PaymentChannel;
  enabled: boolean;
  analysisId: string | null;
  onRestored: () => void;
}) {
  const attempted = useRef(false);
  useEffect(() => {
    if (!enabled || channel !== "google_play" || attempted.current) return;
    attempted.current = true;
    let cancelled = false;
    void restoreGooglePlayPurchases(analysisId ?? undefined)
      .then((restored) => {
        if (cancelled || restored.length === 0) return;
        onRestored();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [analysisId, channel, enabled, onRestored]);

  return null;
}
