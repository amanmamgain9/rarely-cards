"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PublicVideoGeneration } from "@/lib/video/types";

export function StudioVideoPending({
  analysisId,
  petName,
}: {
  analysisId: string;
  petName: string;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      try {
        const response = await fetch(`/api/analyses/${analysisId}/video`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("status_unavailable");
        const generation = (await response.json()) as PublicVideoGeneration | null;
        if (cancelled) return;
        if (generation?.status === "succeeded") {
          router.refresh();
          return;
        }
        if (generation?.status === "failed") {
          setFailed(true);
          return;
        }
      } catch {
        // A temporary network miss should not turn an in-progress video into a failure.
      }
      if (!cancelled) timer = setTimeout(check, 8_000);
    }

    timer = setTimeout(check, 2_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [analysisId, router]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-ink/90 via-ink/10 to-transparent p-8 text-center text-white">
      {!failed && (
        <span className="mb-4 size-10 animate-spin rounded-full border-4 border-white/25 border-t-yellow" aria-hidden="true" />
      )}
      <strong className="font-display text-xl font-normal">
        {failed ? "Generation failed" : "Generating video"}
      </strong>
      <p className="mt-2 text-sm font-bold text-white/80">
        {failed
          ? `${petName}'s video credit was returned.`
          : "This page will update when the video finishes."}
      </p>
    </div>
  );
}
