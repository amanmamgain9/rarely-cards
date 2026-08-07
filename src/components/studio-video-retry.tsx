"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StudioVideoRetry({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function retry() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/video`, {
        method: "PATCH",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Retry could not start.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retry could not start.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        className="min-h-12 rounded-xl border-2 border-ink bg-yellow px-6 font-black shadow-[3px_3px_0_#241a44] disabled:opacity-50"
        type="button"
        disabled={busy}
        onClick={() => void retry()}
      >
        {busy ? "Retrying…" : "Retry video — no extra credit"}
      </button>
      {message && <p className="mt-3 text-sm font-bold text-pink" role="alert">{message}</p>}
    </div>
  );
}
