"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { StudioDraft } from "@/lib/studio/videos";

function draftStep(status: StudioDraft["status"]) {
  switch (status) {
    case "awaiting_payment":
    case "payment_pending":
      return "Photo ready";
    case "awaiting_name":
      return "Choose their line";
    default:
      return "Unfinished";
  }
}

export function StudioDraftCard({ draft }: { draft: StudioDraft }) {
  const [deleted, setDeleted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function deleteDraft() {
    if (!window.confirm("Delete this draft and its saved photo?")) return;

    setMessage(null);
    setDeleted(true);
    try {
      const response = await fetch(`/api/analyses/${draft.id}?draft=1`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "The draft could not be deleted.");
      }
    } catch (error) {
      setDeleted(false);
      setMessage(
        error instanceof Error ? error.message : "The draft could not be deleted.",
      );
    }
  }

  if (deleted) return null;

  return (
    <article className="grid min-h-44 grid-cols-[138px_minmax(0,1fr)] overflow-hidden rounded-[20px] border-[3px] border-ink bg-white shadow-[5px_6px_0_#ffe36e] max-sm:grid-cols-[108px_minmax(0,1fr)]">
      <Link
        aria-label="Continue this draft"
        className="group relative min-h-44 overflow-hidden border-r-[3px] border-ink bg-purple"
        href={`/studio/generate?draft=${draft.id}`}
      >
        <Image
          alt="Your draft pet photo"
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
          fill
          sizes="138px"
          src={draft.photoUrl}
          unoptimized
        />
        <span className="absolute left-3 top-3 -rotate-2 rounded-sm border-2 border-ink bg-yellow px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-wider shadow-[2px_2px_0_#241a44]">
          Draft
        </span>
      </Link>
      <div className="flex min-w-0 flex-col justify-between p-5 max-sm:p-4">
        <div>
          <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-ink-muted">
            {draftStep(draft.status)}
          </span>
          <h3 className="mt-2 truncate font-display text-xl font-normal text-pink">
            {draft.petName?.trim() || "Untitled pet"}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-ink-muted">
            {draft.dialogue
              ? `“${draft.dialogue}”`
              : "Your photo is saved and ready to continue."}
          </p>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <Link
            className="inline-flex min-h-10 items-center rounded-lg border-2 border-ink bg-pink px-4 text-xs font-black text-white shadow-[2px_2px_0_#241a44] transition-transform hover:-translate-y-0.5"
            href={`/studio/generate?draft=${draft.id}`}
          >
            Continue →
          </Link>
          <button
            className="min-h-10 px-1 text-xs font-black text-ink-muted underline decoration-2 underline-offset-4 hover:text-pink"
            onClick={() => void deleteDraft()}
            type="button"
          >
            Delete
          </button>
        </div>
        {message && (
          <p className="mt-2 text-xs font-bold text-[#8f1945]" role="alert">
            {message}
          </p>
        )}
      </div>
    </article>
  );
}
