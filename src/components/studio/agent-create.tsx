"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { clearPendingPhoto, loadPendingPhoto, savePendingPhoto } from "@/lib/analysis/pending-photo";

type ChatMessage = { role: "user" | "assistant"; text: string };
type SelectedPhoto = { id: string; file: File; preview: string; label: string };

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function defaultLabel(index: number) {
  return index === 0 ? "Main subject" : `Reference ${index + 1}`;
}

export function AgentCreate() {
  const input = useRef<HTMLInputElement>(null);
  const photosRef = useRef<SelectedPhoto[]>([]);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [request, setRequest] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function replacePhotos(next: SelectedPhoto[]) {
    photosRef.current = next;
    setPhotos(next);
  }

  useEffect(() => {
    let active = true;
    void loadPendingPhoto().then((pending) => {
      if (!active || !pending || photosRef.current.length) return;
      replacePhotos([{ id: crypto.randomUUID(), file: pending.file, preview: URL.createObjectURL(pending.file), label: "Main subject" }]);
    }).catch(() => undefined);
    return () => {
      active = false;
      photosRef.current.forEach(({ preview }) => URL.revokeObjectURL(preview));
    };
  }, []);

  async function choosePhotos(files?: FileList | null) {
    if (!files?.length) return;
    const additions = Array.from(files);
    if (photos.length + additions.length > MAX_PHOTOS) {
      setError(`Choose no more than ${MAX_PHOTOS} pictures.`);
      return;
    }
    if (additions.some((file) => !PHOTO_TYPES.has(file.type) || file.size > MAX_PHOTO_BYTES)) {
      setError("Use JPEG, PNG, or WebP pictures up to 10 MB each.");
      return;
    }
    const next = [...photos, ...additions.map((file, offset) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      label: defaultLabel(photos.length + offset),
    }))];
    replacePhotos(next);
    setMessages([]);
    setError(null);
    if (photos.length === 0) await savePendingPhoto(additions[0], "pet").catch(() => undefined);
    if (input.current) input.current.value = "";
  }

  function removePhoto(id: string) {
    const removed = photos.find((photo) => photo.id === id);
    if (removed) URL.revokeObjectURL(removed.preview);
    const next = photos.filter((photo) => photo.id !== id);
    replacePhotos(next);
    setError(null);
    if (next[0]) void savePendingPhoto(next[0].file, "pet").catch(() => undefined);
    else void clearPendingPhoto().catch(() => undefined);
  }

  function labelPhoto(id: string, label: string) {
    replacePhotos(photos.map((photo) => photo.id === id ? { ...photo, label } : photo));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = request.trim();
    if (!photos.length || photos.some(({ label }) => !label.trim()) || !text || busy) return;
    setBusy(true);
    setError(null);
    setMessages((current) => [...current, { role: "user", text }]);
    setRequest("");
    try {
      const form = new FormData();
      photos.forEach(({ file, label }) => {
        form.append("photos", file);
        form.append("labels", label.trim());
      });
      form.set("request", text);
      const response = await fetch("/api/video-agent", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Agent could not process this request.");
      setMessages((current) => [...current, { role: "assistant", text: payload.message }]);
      await clearPendingPhoto().catch(() => undefined);
    } catch (caught) {
      setRequest(text);
      setError(caught instanceof Error ? caught.message : "Agent could not process this request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mx-auto grid w-full max-w-2xl gap-5" onSubmit={submit}>
      <input
        ref={input}
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        multiple
        type="file"
        onChange={(event) => void choosePhotos(event.target.files)}
      />

      <section className="grid gap-3" aria-labelledby="pictures-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-normal" id="pictures-heading">Pictures</h2>
            <p className="text-sm font-bold text-ink-muted">Add and label up to four.</p>
          </div>
          {photos.length > 0 && photos.length < MAX_PHOTOS && (
            <button className="rounded-full border-2 border-ink bg-white px-4 py-2 text-xs font-black" type="button" onClick={() => input.current?.click()}>
              Add picture
            </button>
          )}
        </div>

        {photos.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((photo, index) => (
              <li className="grid gap-2 rounded-2xl border-2 border-ink bg-white p-2" key={photo.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="aspect-square w-full rounded-xl bg-cream object-contain" src={photo.preview} alt={`Picture ${index + 1}`} />
                <label className="grid gap-1">
                  <span className="text-[11px] font-black uppercase tracking-wide text-ink-muted">Label</span>
                  <input
                    aria-label={`Label for picture ${index + 1}`}
                    className="min-w-0 rounded-lg border border-ink/30 px-2 py-1 text-sm font-bold outline-none focus:border-pink"
                    maxLength={60}
                    value={photo.label}
                    onChange={(event) => labelPhoto(photo.id, event.target.value)}
                  />
                </label>
                <button className="text-xs font-black text-[#8f1945]" type="button" onClick={() => removePhoto(photo.id)}>Remove</button>
              </li>
            ))}
          </ul>
        ) : (
          <button
            className="grid min-h-64 place-items-center rounded-3xl border-2 border-dashed border-ink/35 bg-white p-5 text-center transition hover:border-pink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink"
            type="button"
            onClick={() => input.current?.click()}
          >
            <span>
              <strong className="block font-display text-3xl font-normal">Choose pictures</strong>
              <small className="mt-2 block text-sm font-bold text-ink-muted">JPEG, PNG, or WebP · up to 4</small>
            </span>
          </button>
        )}
      </section>

      {messages.length > 0 && (
        <ol className="grid gap-3" aria-live="polite">
          {messages.map((message, index) => (
            <li
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm font-bold ${message.role === "user" ? "ml-auto bg-purple text-white" : "mr-auto border-2 border-ink/15 bg-white text-ink"}`}
              key={`${message.role}-${index}`}
            >
              <span className="sr-only">{message.role === "user" ? "You" : "Rarely"}: </span>
              {message.text}
            </li>
          ))}
          {busy && <li className="mr-auto rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-sm font-bold text-ink-muted">Thinking…</li>}
        </ol>
      )}

      <label className="grid gap-2">
        <span className="font-display text-2xl font-normal">What do you want?</span>
        <textarea
          className="min-h-32 resize-none rounded-2xl border-2 border-ink bg-white p-4 text-base font-bold outline-none placeholder:text-ink-muted/60 focus:border-pink"
          maxLength={1000}
          placeholder="Make my dog ask for treats like a tiny crime boss."
          value={request}
          onChange={(event) => setRequest(event.target.value)}
        />
      </label>

      <button
        className="min-h-14 rounded-2xl border-2 border-ink bg-pink px-6 text-base font-black text-white shadow-[4px_4px_0_#241a44] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!photos.length || photos.some(({ label }) => !label.trim()) || !request.trim() || busy}
        type="submit"
      >
        {busy ? "Thinking…" : "Send"}
      </button>
      {error && <p className="rounded-xl border-2 border-pink/30 bg-white p-4 text-sm font-bold text-[#8f1945]" role="alert">{error}</p>}
    </form>
  );
}
