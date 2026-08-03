"use client";

import { useState } from "react";

export function StudioVideoActions({
  videoUrl,
  petName,
}: {
  videoUrl: string;
  petName: string;
}) {
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function getFile() {
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error("The saved video could not be opened.");
    const blob = await response.blob();
    const slug = petName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return new File([blob], `rarely-${slug || "my-pet"}.mp4`, {
      type: "video/mp4",
    });
  }

  function saveFile(file: File) {
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  async function download() {
    if (busy) return;
    setBusy("download");
    setMessage(null);
    try {
      const file = await getFile();
      saveFile(file);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The video could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (busy) return;
    setBusy("share");
    setMessage(null);
    try {
      const file = await getFile();
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${petName}'s video`,
        });
      } else {
        saveFile(file);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessage(error instanceof Error ? error.message : "The video could not be shared.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button
          className="inline-flex min-h-12 items-center rounded-xl border-2 border-ink bg-pink px-5 font-black text-white shadow-[3px_3px_0_#241a44] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
          type="button"
          disabled={busy !== null}
          onClick={() => void share()}
        >
          {busy === "share" ? "Preparing…" : "Share video"}
        </button>
        <button
          className="inline-flex min-h-12 items-center rounded-xl border-2 border-ink bg-white px-5 font-black text-ink shadow-[3px_3px_0_#241a44] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
          type="button"
          disabled={busy !== null}
          onClick={() => void download()}
        >
          {busy === "download" ? "Saving…" : "Download"}
        </button>
      </div>
      {message && (
        <p className="mt-3 text-sm font-extrabold text-[#8f1945]" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
