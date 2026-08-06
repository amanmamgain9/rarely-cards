"use client";

import { useState } from "react";
import type { ProductFeedback } from "@/lib/feedback";

type FeedbackKind = ProductFeedback["kind"];
type FeedbackRating = NonNullable<ProductFeedback["rating"]>;

const ratings: Array<{ value: FeedbackRating; label: string }> = [
  { value: "loved", label: "Loved it" },
  { value: "okay", label: "It’s okay" },
  { value: "needs_work", label: "Needs work" },
];

export function StudioVideoFeedback({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("video_experience");
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseKind(nextKind: FeedbackKind) {
    setKind(nextKind);
    setError(null);
    setSent(false);
  }

  async function sendFeedback() {
    if (sending) return;
    if (kind === "video_experience" && !rating) {
      setError("Choose how the video felt.");
      return;
    }
    if (kind === "feature_request" && message.trim().length < 3) {
      setError("Tell us a little about the feature.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, rating, message, videoId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error || "Your note could not be sent.");
      setSent(true);
      setMessage("");
      setRating(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your note could not be sent.");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        className="mt-8 inline-flex min-h-10 items-center border-0 bg-transparent p-0 text-sm font-black text-ink-muted underline decoration-2 underline-offset-4 hover:text-pink"
        type="button"
        onClick={() => setOpen(true)}
      >
        Have an idea for Rarely? Leave a note →
      </button>
    );
  }

  return (
    <section className="mt-8 max-w-md rounded-2xl border-2 border-ink bg-cream p-4 shadow-[4px_4px_0_#a98cf4]" aria-labelledby="feedback-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[8px] font-bold uppercase tracking-wider text-pink">Director’s note</p>
          <h2 className="mt-1 text-base font-black" id="feedback-heading">Help shape Rarely</h2>
        </div>
        <button
          aria-label="Close feedback"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-ink/20 bg-white text-lg font-black text-ink-muted hover:border-pink hover:text-pink"
          type="button"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </div>

      {sent ? (
        <div className="mt-4 rounded-xl bg-purple/20 p-4" role="status">
          <p className="font-black">Note received. Thank you.</p>
          <button
            className="mt-2 text-sm font-black text-pink underline decoration-2 underline-offset-4"
            type="button"
            onClick={() => setSent(false)}
          >
            Send another
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Feedback type">
            <button
              className={`min-h-10 rounded-lg border-2 px-3 text-sm font-black ${kind === "video_experience" ? "border-ink bg-yellow" : "border-ink/20 bg-white text-ink-muted"}`}
              type="button"
              aria-pressed={kind === "video_experience"}
              onClick={() => chooseKind("video_experience")}
            >
              This video
            </button>
            <button
              className={`min-h-10 rounded-lg border-2 px-3 text-sm font-black ${kind === "feature_request" ? "border-ink bg-yellow" : "border-ink/20 bg-white text-ink-muted"}`}
              type="button"
              aria-pressed={kind === "feature_request"}
              onClick={() => chooseKind("feature_request")}
            >
              Feature idea
            </button>
          </div>

          {kind === "video_experience" && (
            <fieldset className="mt-4">
              <legend className="text-sm font-black">How did this video feel?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {ratings.map((option) => (
                  <button
                    className={`min-h-10 rounded-full border-2 px-3 text-xs font-black ${rating === option.value ? "border-ink bg-pink text-white" : "border-ink/20 bg-white text-ink-muted"}`}
                    key={option.value}
                    type="button"
                    aria-pressed={rating === option.value}
                    onClick={() => {
                      setRating(option.value);
                      setError(null);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <label className="mt-4 grid gap-2 text-sm font-black">
            {kind === "feature_request" ? "What should Rarely add?" : "Anything we should improve? (optional)"}
            <textarea
              className="min-h-24 resize-y rounded-xl border-2 border-ink/20 bg-white p-3 text-sm font-bold text-ink outline-none placeholder:text-ink-muted/55 focus:border-purple"
              maxLength={1000}
              onChange={(event) => {
                setMessage(event.target.value);
                setError(null);
              }}
              placeholder={kind === "feature_request" ? "I’d love to…" : "Voice, movement, quality…"}
              rows={3}
              value={message}
            />
          </label>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[8px] text-ink-muted">{message.length}/1000</span>
            <button
              className="min-h-10 rounded-xl border-2 border-ink bg-pink px-4 text-sm font-black text-white shadow-[2px_2px_0_#241a44] disabled:cursor-wait disabled:opacity-60"
              disabled={sending}
              type="button"
              onClick={() => void sendFeedback()}
            >
              {sending ? "Sending…" : "Send note"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm font-extrabold text-[#8f1945]" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
