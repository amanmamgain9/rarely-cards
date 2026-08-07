"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StudioHeader } from "@/components/studio-header";
import { PetVoiceAccentPicker } from "@/components/rarity/pet-voice-accent-picker";
import {
  DEFAULT_PET_VOICE_ACCENT,
  type PetVoiceAccent,
} from "@/lib/video/accent";

type PetPhoto = { file: File; url: string };
const MAX_PET_PHOTOS = 6;

type BirthdayDraft = {
  id: string;
  photoUrl: string;
  recipientName: string;
  dialogue: string | null;
  voiceAccent: PetVoiceAccent;
};

function defaultGreeting(name: string, petCount?: number) {
  const message =
    petCount === 1
      ? `Happy birthday, ${name}! Thank you for taking such good care of me!`
      : petCount && petCount > 1
        ? `Happy birthday, ${name}! Thank you for taking such good care of all of us!`
        : `Happy birthday, ${name}! Thank you for taking care of all of us!`;
  return message.slice(0, 120);
}

export function BirthdayStudio({
  creditBalance,
  imageConfigured,
  seedanceConfigured,
  initialDraft,
}: {
  creditBalance: number;
  imageConfigured: boolean;
  seedanceConfigured: boolean;
  initialDraft: BirthdayDraft | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PetPhoto[]>([]);
  const [recipientName, setRecipientName] = useState(
    initialDraft?.recipientName ?? "",
  );
  const [sceneUrl, setSceneUrl] = useState<string | null>(
    initialDraft?.photoUrl ?? null,
  );
  const [analysisId, setAnalysisId] = useState<string | null>(
    initialDraft?.id ?? null,
  );
  const [step, setStep] = useState<"photos" | "details" | "review" | "greeting">(
    initialDraft ? "greeting" : "photos",
  );
  const [greeting, setGreeting] = useState(
    initialDraft?.dialogue ??
      (initialDraft?.recipientName
        ? defaultGreeting(initialDraft.recipientName)
        : ""),
  );
  const [voiceAccent, setVoiceAccent] = useState<PetVoiceAccent>(
    initialDraft?.voiceAccent ?? DEFAULT_PET_VOICE_ACCENT,
  );
  const [busy, setBusy] = useState(false);
  const [generatingPortrait, setGeneratingPortrait] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const cleanupRef = useRef<{ photoUrls: string[]; sceneUrl: string | null }>({
    photoUrls: [],
    sceneUrl: null,
  });
  useEffect(() => {
    cleanupRef.current = {
      photoUrls: photos.map((photo) => photo.url),
      sceneUrl,
    };
  }, [photos, sceneUrl]);

  useEffect(() => () => {
    cleanupRef.current.photoUrls.forEach((url) => URL.revokeObjectURL(url));
    if (cleanupRef.current.sceneUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(cleanupRef.current.sceneUrl);
    }
  }, []);

  useEffect(() => {
    if (!analysisId || !recipientName.trim() || !greeting.trim()) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/birthday-scene", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          recipientName,
          greeting,
          voiceAccent,
        }),
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [analysisId, greeting, recipientName, voiceAccent]);

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    setMessage(null);
    setPhotos((current) => {
      const room = Math.max(0, MAX_PET_PHOTOS - current.length);
      return [
        ...current,
        ...picked.slice(0, room).map((file) => ({
          file,
          url: URL.createObjectURL(file),
        })),
      ];
    });
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].url);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  }

  async function generatePortrait() {
    const name = recipientName.trim();
    if (!name || photos.length < 1) {
      setMessage("Add a birthday name and at least one pet photo.");
      return;
    }
    if (!imageConfigured) {
      setMessage("Birthday portraits are temporarily unavailable.");
      return;
    }
    setBusy(true);
    setGeneratingPortrait(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("recipientName", name);
      form.set("clientFlow", "stored-preview-v1");
      if (greeting.trim()) form.set("greeting", greeting.trim());
      form.set("voiceAccent", voiceAccent);
      if (analysisId) form.set("draftId", analysisId);
      photos.forEach(({ file }) => form.append("pets", file));
      const response = await fetch("/api/birthday-scene", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (payload.needsCredits) {
          router.push("/studio/credits");
          return;
        }
        throw new Error(payload.error || "The birthday portrait could not be created.");
      }
      const payload = await response.json();
      if (typeof payload.id !== "string" || typeof payload.previewUrl !== "string") {
        throw new Error("The saved portrait response was incomplete. Try again.");
      }
      if (sceneUrl?.startsWith("blob:")) URL.revokeObjectURL(sceneUrl);
      setAnalysisId(payload.id);
      setSceneUrl(payload.previewUrl);
      setGreeting((current) =>
        current.trim() ? current : defaultGreeting(name, photos.length),
      );
      setStep("review");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The birthday portrait could not be created.",
      );
    } finally {
      setBusy(false);
      setGeneratingPortrait(false);
    }
  }

  function approvePortrait() {
    if (!analysisId) return;
    setMessage(null);
    window.history.replaceState(null, "", `/studio/birthday?draft=${analysisId}`);
    setStep("greeting");
  }

  async function makeVideo(event: FormEvent) {
    event.preventDefault();
    if (!analysisId || !greeting.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "birthday",
          recipientName: recipientName.trim(),
          dialogue: greeting.trim(),
          voiceAccent,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.needsCredits) {
          router.push(`/studio/credits?draft=${analysisId}`);
          return;
        }
        throw new Error(payload.error || "The birthday video could not start.");
      }
      router.push(`/studio/videos/${payload.id}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The birthday video could not start.",
      );
    } finally {
      setBusy(false);
    }
  }

  const canGenerate = recipientName.trim() && !busy;

  return (
    <main className="min-h-svh bg-[#ffd7e8] text-ink">
      <StudioHeader creditBalance={creditBalance} />
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={addPhotos}
      />

      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[1080px] pb-20 pt-10 max-sm:w-[calc(100%-1.5rem)] max-sm:pb-12 max-sm:pt-7">
        <div className="mb-8 flex items-end justify-between gap-5 max-md:items-start max-md:flex-col">
          <div>
            <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-pink">
              Birthday studio
            </p>
            <h1 className="max-w-[760px] font-display text-[clamp(2.35rem,7vw,5.2rem)] font-normal leading-[0.94] tracking-[-0.045em]">
              Make a pet birthday video.
            </h1>
          </div>
          <Link className="shrink-0 text-xs font-black text-ink-muted underline decoration-2 underline-offset-4 hover:text-pink" href="/studio/talking-pet">
            Make a one-pet video
          </Link>
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
          <section className="rounded-[26px] border-[3px] border-ink bg-cream p-6 shadow-[7px_8px_0_#a98cf4] max-sm:p-4" aria-labelledby="birthday-controls-title">
            <h2 className="font-display text-2xl font-normal" id="birthday-controls-title">
              {step === "photos"
                ? "Add the pets"
                : step === "details"
                  ? "Add the greeting"
                  : step === "review"
                    ? "Check every face"
                    : "Choose the voice"}
            </h2>

            {step === "photos" && (
              <>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {photos.map((photo, index) => (
                    <figure className="relative m-0 aspect-[4/3] overflow-hidden rounded-xl border-2 border-ink bg-purple" key={photo.url}>
                      {/* Local previews intentionally render directly. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="size-full object-contain" src={photo.url} alt={`Pet ${index + 1}`} />
                      <figcaption className="absolute bottom-2 left-2 rounded-md border border-ink bg-yellow px-2 py-1 font-mono text-[8px] font-bold uppercase">
                        Pet {index + 1}
                      </figcaption>
                      <button className="absolute right-2 top-2 grid size-8 place-items-center rounded-full border-2 border-ink bg-white text-lg font-black" type="button" onClick={() => removePhoto(index)} aria-label={`Remove pet ${index + 1}`}>×</button>
                    </figure>
                  ))}
                  {photos.length < MAX_PET_PHOTOS && (
                    <button className="grid aspect-[4/3] place-items-center rounded-xl border-2 border-dashed border-ink/45 bg-white/60 p-4 text-center text-xs font-black text-ink-muted hover:border-pink hover:text-pink" type="button" onClick={() => fileInput.current?.click()}>
                      <span><b className="block text-3xl leading-none">+</b>Add pet photos</span>
                    </button>
                  )}
                </div>
                <p className="mt-3 text-xs font-bold text-ink-muted">1–6 clear cat or dog photos.</p>
                <button className="mt-6 min-h-12 w-full rounded-xl border-2 border-ink bg-pink px-5 font-black text-white shadow-[3px_3px_0_#241a44] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={photos.length < 1} onClick={() => setStep("details")}>
                  Continue →
                </button>
              </>
            )}

            {step === "details" && (
              <>
                <label className="mt-6 grid gap-2 text-sm font-black">
                  Who is celebrating?
                  <input
                    className="min-h-12 rounded-xl border-2 border-ink bg-white px-4 text-base font-bold outline-none placeholder:text-ink/35 focus:border-pink"
                    value={recipientName}
                    maxLength={40}
                    onChange={(event) => setRecipientName(event.target.value)}
                    placeholder="Mommy, Dad, Priya…"
                  />
                </label>

                <label className="mt-5 grid gap-2 text-sm font-black">
                  Birthday message
                  <textarea
                    className="min-h-24 resize-none rounded-xl border-2 border-ink bg-white p-4 text-base font-bold outline-none placeholder:text-ink/35 focus:border-pink"
                    value={greeting}
                    maxLength={120}
                    onChange={(event) => setGreeting(event.target.value)}
                    placeholder={defaultGreeting(recipientName.trim() || "your favorite human", photos.length)}
                  />
                  <span className="text-right font-mono text-[8px] font-medium text-ink-muted">{greeting.length}/120</span>
                </label>

                <button className="mt-6 min-h-12 w-full rounded-xl border-2 border-ink bg-pink px-5 font-black text-white shadow-[3px_3px_0_#241a44] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={!canGenerate} onClick={() => void generatePortrait()}>
                  {generatingPortrait ? "Creating their portrait…" : "Create birthday portrait"}
                </button>
                <button className="mt-3 min-h-10 w-full text-xs font-black text-ink-muted underline decoration-2 underline-offset-4" type="button" onClick={() => setStep("photos")}>
                  Back to photos
                </button>
              </>
            )}

            {step === "review" && (
              <div className="mt-6">
                <p className="text-sm font-bold text-ink-muted">Is every pet here, once, and still recognizable?</p>
                <button className="mt-5 min-h-12 w-full rounded-xl border-2 border-ink bg-pink px-5 font-black text-white shadow-[3px_3px_0_#241a44] disabled:opacity-45" type="button" disabled={busy || !analysisId} onClick={approvePortrait}>
                  Use this portrait
                </button>
                <button className="mt-3 min-h-11 w-full rounded-xl border-2 border-ink bg-white px-5 text-sm font-black" type="button" disabled={busy} onClick={() => void generatePortrait()}>
                  Make another version
                </button>
                <button className="mt-3 min-h-10 w-full text-xs font-black text-ink-muted underline decoration-2 underline-offset-4" type="button" onClick={() => setStep("photos")}>
                  Change photos
                </button>
              </div>
            )}

            {step === "greeting" && (
              <form className="mt-6" onSubmit={makeVideo}>
                <label className="grid gap-2 text-sm font-black">
                  What should they say?
                  <textarea className="min-h-28 resize-none rounded-xl border-2 border-ink bg-white p-4 text-base font-bold outline-none focus:border-pink" value={greeting} maxLength={120} onChange={(event) => setGreeting(event.target.value)} />
                  <span className="text-right font-mono text-[8px] font-medium text-ink-muted">{greeting.length}/120</span>
                </label>
                <details className="group mt-4 overflow-hidden rounded-xl border border-ink/15 bg-white">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 text-sm font-black marker:hidden">
                    Voice accent <span className="font-mono text-[8px] font-medium uppercase text-ink-muted">Optional</span>
                    <span className="text-lg text-pink group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <div className="border-t border-ink/10 p-4 pt-0">
                    <PetVoiceAccentPicker value={voiceAccent} onChange={setVoiceAccent} />
                  </div>
                </details>
                <button className="mt-5 min-h-12 w-full rounded-xl border-2 border-ink bg-pink px-5 font-black text-white shadow-[3px_3px_0_#241a44] disabled:opacity-45" type="submit" disabled={!analysisId || !greeting.trim() || busy || !seedanceConfigured}>
                  {busy ? "Starting birthday video…" : "Make birthday video"}
                </button>
              </form>
            )}

            {message && <p className="mt-5 rounded-xl border-2 border-[#d73b75] bg-[#fff0f5] px-4 py-3 text-sm font-extrabold text-[#8f1945]" role="alert">{message}</p>}
          </section>

          <section className="relative mx-auto aspect-[9/16] w-full max-w-[430px] overflow-hidden rounded-[30px] border-[3px] border-ink bg-ink shadow-[8px_9px_0_#ffe36e]" aria-label="Full 9:16 birthday portrait preview">
            {generatingPortrait ? (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_25%,#a98cf4_0_12%,transparent_12.5%),linear-gradient(160deg,#f4458f,#ff9cc5_55%,#ffe36e)] p-10 text-center text-white" role="status" aria-live="polite">
                <div className="max-w-sm">
                  <div className="mx-auto flex h-20 w-fit items-end justify-center gap-2 rounded-full border-[3px] border-ink bg-yellow px-5 pb-5 shadow-[5px_5px_0_#241a44]" aria-hidden="true">
                    <span className="size-3 animate-bounce rounded-full border-2 border-ink bg-pink motion-reduce:animate-none [animation-delay:-0.3s]" />
                    <span className="size-4 animate-bounce rounded-full border-2 border-ink bg-purple motion-reduce:animate-none [animation-delay:-0.15s]" />
                    <span className="size-3 animate-bounce rounded-full border-2 border-ink bg-pink motion-reduce:animate-none" />
                  </div>
                  <p className="mt-7 font-display text-3xl leading-tight">Building their birthday scene…</p>
                  <p className="mt-3 text-sm font-black text-white/85">Keeping every face while giving them natural poses.</p>
                </div>
              </div>
            ) : sceneUrl ? (
              // Generated and resumed portraits load from the authenticated photo route.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="absolute inset-0 size-full bg-ink object-cover"
                src={sceneUrl}
                alt={`Birthday portrait for ${recipientName || "your person"}`}
                onError={() => setMessage("The portrait preview could not be loaded. Create another version.")}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_25%,#a98cf4_0_12%,transparent_12.5%),linear-gradient(160deg,#f4458f,#ff9cc5_55%,#ffe36e)] p-10 text-center text-white">
                <div className="max-w-sm">
                  <span className="mx-auto grid size-20 place-items-center rounded-full border-[3px] border-ink bg-yellow text-4xl text-ink shadow-[5px_5px_0_#241a44]">★</span>
                  <p className="mt-7 font-display text-3xl leading-tight">Their party portrait appears here.</p>
                  <p className="mt-3 text-sm font-black text-white/85">One candid scene. Every pet. No stiff lineup.</p>
                </div>
              </div>
            )}
            <span className="absolute left-4 top-4 rounded-md border-2 border-ink bg-yellow px-3 py-1.5 font-mono text-[9px] font-bold uppercase shadow-[2px_2px_0_#241a44]">
              {generatingPortrait ? "Creating portrait" : sceneUrl ? "Full portrait · 9:16" : "9:16 video frame"}
            </span>
          </section>
        </div>
      </section>
    </main>
  );
}
