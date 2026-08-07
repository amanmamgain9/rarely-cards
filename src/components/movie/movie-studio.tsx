"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StudioHeader } from "@/components/studio/studio-header";
import { VoiceRecorder } from "@/components/movie/voice-recorder";
import { createAnalysisFromPhoto } from "@/lib/analysis/client";
import { movieCatalog, movieDefaults, movieMoments } from "@/lib/movie/scenes";

type MovieDraft = {
  id: string;
  photoUrl: string;
  sourcePhotoUrl: string;
  dialogue: string | null;
  movie: string;
  scene: string;
  voiceInstruction: string;
  voiceUrl: string | null;
  sceneReady: boolean;
};

export function MovieStudio({
  creditBalance,
  imageConfigured,
  seedanceConfigured,
  initialDraft,
}: {
  creditBalance: number;
  imageConfigured: boolean;
  seedanceConfigured: boolean;
  initialDraft: MovieDraft | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const firstMovie = movieCatalog[0];
  const initialMovie = initialDraft?.movie ?? firstMovie.title;
  const initialDefaults = movieDefaults(initialMovie);
  const initialMoments = movieMoments(initialMovie);
  const [file, setFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(initialDraft?.sourcePhotoUrl ?? null);
  const [analysisId, setAnalysisId] = useState(initialDraft?.id ?? null);
  const [movie, setMovie] = useState(initialMovie);
  const [scene, setScene] = useState(initialDraft?.scene ?? initialMoments[1]?.scene ?? initialMoments[0].scene);
  const [scenePreview, setScenePreview] = useState<string | null>(initialDraft?.sceneReady ? initialDraft.photoUrl : null);
  const [sceneApproved, setSceneApproved] = useState(Boolean(initialDraft?.sceneReady));
  const [dialogue, setDialogue] = useState(initialDraft?.dialogue || initialDefaults.dialogues[1]?.line || initialDefaults.dialogues[0].line);
  const [voiceInstruction, setVoiceInstruction] = useState(initialDraft?.voiceInstruction ?? "");
  const [voiceUrl, setVoiceUrl] = useState<string | null>(initialDraft?.voiceUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [applyingInstructions, setApplyingInstructions] = useState(false);
  const [typedInstruction, setTypedInstruction] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedPreset = movieCatalog.find((entry) => entry.title === movie);
  const moments = movieMoments(movie);
  const selectedMoment = moments.findIndex((option) => option.scene === scene && option.dialogue === dialogue);

  useEffect(() => () => {
    if (sourcePreview?.startsWith("blob:")) URL.revokeObjectURL(sourcePreview);
  }, [sourcePreview]);

  useEffect(() => {
    if (!analysisId || !movie.trim() || !scene.trim() || !dialogue.trim()) return;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      await fetch("/api/movie-scene", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          movie,
          scene,
          dialogue,
          voiceInstruction,
        }),
      }).finally(() => setSaving(false));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [analysisId, dialogue, movie, scene, voiceInstruction]);

  function resetGeneratedScene() {
    setScenePreview(null);
    setSceneApproved(false);
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    if (sourcePreview?.startsWith("blob:")) URL.revokeObjectURL(sourcePreview);
    setFile(picked);
    setSourcePreview(URL.createObjectURL(picked));
    setAnalysisId(null);
    setVoiceUrl(null);
    resetGeneratedScene();
    setMessage(null);
  }

  async function ensureDraft() {
    if (analysisId) return analysisId;
    if (!file) throw new Error("Choose your pet photo first.");
    const created = await createAnalysisFromPhoto({
      file,
      cardStyle: "pet",
      experienceKind: "movie_scene",
    });
    setAnalysisId(created.id);
    window.history.replaceState(null, "", `/studio/movie?draft=${created.id}`);
    return created.id;
  }

  function selectMovie(title: string) {
    const nextMoments = movieMoments(title);
    const nextMoment = nextMoments[1] ?? nextMoments[0];
    setMovie(title);
    setScene(nextMoment?.scene ?? "");
    const defaults = movieDefaults(title);
    setDialogue(nextMoment?.dialogue ?? defaults.dialogues[0].line);
    resetGeneratedScene();
  }

  function applyInstructions(result: {
    movie: string;
    scene: string;
    dialogue: string;
    voiceInstruction: string;
    voiceUrl: string | null;
  }) {
    if (result.movie) setMovie(result.movie);
    if (result.scene) setScene(result.scene);
    if (result.dialogue) setDialogue(result.dialogue);
    if (result.voiceInstruction) setVoiceInstruction(result.voiceInstruction);
    setVoiceUrl(result.voiceUrl);
    resetGeneratedScene();
  }

  async function applyTypedInstructions() {
    if (!typedInstruction.trim() || applyingInstructions) return;
    setApplyingInstructions(true);
    setMessage(null);
    try {
      const id = await ensureDraft();
      const form = new FormData();
      form.set("analysisId", id);
      form.set("mode", "scene");
      form.set("instruction", typedInstruction.trim());
      const response = await fetch("/api/movie-voice", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Those instructions could not be applied.");
      applyInstructions(payload);
      setTypedInstruction("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Those instructions could not be applied.");
    } finally {
      setApplyingInstructions(false);
    }
  }

  async function generateScene() {
    if (busy || !movie.trim() || !scene.trim()) return;
    if (!imageConfigured) {
      setMessage("Movie scenes are temporarily unavailable.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const id = await ensureDraft();
      const response = await fetch("/api/movie-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: id, movie, scene, dialogue, voiceInstruction }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The movie scene could not be created.");
      setScenePreview(payload.previewUrl);
      setSceneApproved(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The movie scene could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function makeVideo(event: FormEvent) {
    event.preventDefault();
    if (!analysisId || !sceneApproved || !dialogue.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "movie",
          dialogue: dialogue.trim(),
          movie,
          scene,
          voiceInstruction,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.needsCredits) {
          router.push(`/studio/credits?draft=${analysisId}`);
          return;
        }
        throw new Error(payload.error || "The movie video could not start.");
      }
      router.push(`/studio/videos/${payload.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The movie video could not start.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-svh bg-[#d9d2ff] text-ink">
      <StudioHeader creditBalance={creditBalance} />
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={choosePhoto} />
      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[1120px] pb-20 pt-10 max-sm:w-[calc(100%-1.5rem)]">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-pink">Movie studio</p>
        <h1 className="mt-3 font-display text-[clamp(2.5rem,7vw,5.2rem)] font-normal leading-[0.92]">Put your pet in a movie.</h1>

        <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_430px]">
          <section className="rounded-[26px] border-[3px] border-ink bg-cream p-6 shadow-[7px_8px_0_#f4458f] max-sm:p-4">
            <h2 className="font-display text-2xl font-normal">1. Add your pet</h2>
            <div className="mt-4 flex items-center gap-4 rounded-2xl border-2 border-ink/20 bg-white p-3">
              {sourcePreview ? (
                <figure className="m-0 grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-ink bg-workspace p-1 max-sm:size-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="max-h-full max-w-full object-contain" src={sourcePreview} alt="Original uploaded pet" />
                </figure>
              ) : (
                <div className="grid size-24 shrink-0 place-items-center rounded-xl border-2 border-dashed border-ink/30 bg-workspace font-display text-2xl text-ink-muted max-sm:size-20">+</div>
              )}
              <div className="min-w-0 flex-1">
                <b className="block text-sm">Original photo</b>
                <p className="mt-1 text-xs font-bold text-ink-muted">Shown uncropped. Gemini uses this full image.</p>
                <button className="mt-3 min-h-9 rounded-lg border-2 border-ink bg-cream px-3 text-xs font-black" type="button" onClick={() => fileInput.current?.click()}>
                  {sourcePreview ? "Change photo" : "Choose photo"}
                </button>
              </div>
            </div>

            <h2 className="mt-8 font-display text-2xl font-normal">2. Pick a movie moment</h2>
            <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Movies">
              {movieCatalog.map((entry) => (
                <button
                  className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border-2 px-4 text-left ${movie === entry.title ? "border-ink bg-yellow shadow-[3px_3px_0_#241a44]" : "border-ink/15 bg-white"}`}
                  key={entry.title}
                  type="button"
                  role="radio"
                  aria-checked={movie === entry.title}
                  onClick={() => selectMovie(entry.title)}
                >
                  <span><b className="block text-sm">{entry.title}</b><small className="text-[11px] font-bold text-ink-muted">3 famous scene + dialogue choices</small></span>
                  <span aria-hidden="true">{movie === entry.title ? "●" : "○"}</span>
                </button>
              ))}
              <button
                className={`min-h-12 rounded-xl border-2 px-4 text-left text-sm font-black ${selectedPreset ? "border-ink/15 bg-white" : "border-ink bg-yellow"}`}
                type="button"
                role="radio"
                aria-checked={!selectedPreset}
                onClick={() => selectMovie("")}
              >
                Another movie…
              </button>
            </div>

            {!selectedPreset && (
              <label className="mt-4 grid gap-2 text-sm font-black">
                Movie title
                <input className="min-h-12 rounded-xl border-2 border-ink bg-white px-4" maxLength={100} placeholder="The Matrix" value={movie} onChange={(event) => { setMovie(event.target.value); resetGeneratedScene(); }} />
              </label>
            )}

            <label className="mt-5 grid gap-2 text-sm font-black">
              Scene + dialogue
              <select
                className="min-h-14 w-full rounded-xl border-2 border-ink bg-white px-3 text-sm font-bold"
                value={selectedMoment >= 0 ? String(selectedMoment) : "custom"}
                onChange={(event) => {
                  const moment = moments[Number(event.target.value)];
                  if (!moment) return;
                  setScene(moment.scene);
                  setDialogue(moment.dialogue);
                  resetGeneratedScene();
                }}
              >
                {moments.map((moment, index) => (
                  <option key={`${moment.scene}-${moment.dialogue}`} value={index}>
                    {moment.kind}: {moment.scene} — “{moment.dialogue}”
                  </option>
                ))}
                <option value="custom">Custom instructions below</option>
              </select>
            </label>

            {!selectedPreset && (
              <label className="mt-3 grid gap-2 text-sm font-black">
                Custom scene
                <input className="min-h-12 rounded-xl border-2 border-ink bg-white px-4" maxLength={160} placeholder="Lobby with green code outside" value={scene} onChange={(event) => { setScene(event.target.value); resetGeneratedScene(); }} />
              </label>
            )}

            <section className="mt-5 rounded-2xl border-2 border-ink bg-yellow/70 p-4" aria-labelledby="customize-moment-title">
              <h3 className="font-display text-xl font-normal" id="customize-moment-title">Want something different?</h3>
              <p className="mb-4 mt-1 text-xs font-bold text-ink-muted">Say the movie, scene, dialogue, or voice. Example: “Godfather office. Say nobody touches my treats, in a quiet raspy voice.”</p>
              <VoiceRecorder
                mode="scene"
                initialUrl={voiceUrl}
                ensureAnalysisId={ensureDraft}
                onResult={applyInstructions}
              />
              <div className="my-4 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-ink/20" />
                <span className="font-mono text-[9px] font-black uppercase text-ink-muted">or type instead</span>
                <span className="h-px flex-1 bg-ink/20" />
              </div>
              <label className="grid gap-2 text-xs font-black">
                Type the same kind of instruction
                <textarea
                  className="min-h-20 resize-none rounded-xl border-2 border-ink bg-white p-3 text-sm"
                  maxLength={600}
                  placeholder="Make it the Titanic bow scene. Say: I'm king of the treats. Excited voice."
                  value={typedInstruction}
                  onChange={(event) => setTypedInstruction(event.target.value)}
                />
              </label>
              <button className="mt-3 min-h-10 w-full rounded-xl border-2 border-ink bg-white px-4 text-sm font-black disabled:opacity-45" type="button" disabled={!typedInstruction.trim() || applyingInstructions} onClick={() => void applyTypedInstructions()}>
                {applyingInstructions ? "Applying…" : "Apply typed instructions"}
              </button>
            </section>

            <button className="mt-5 min-h-12 w-full rounded-xl border-2 border-ink bg-pink px-5 font-black text-white shadow-[3px_3px_0_#241a44] disabled:opacity-45" type="button" disabled={!sourcePreview || !movie.trim() || !scene.trim() || busy} onClick={() => void generateScene()}>
              {busy ? "Creating movie scene…" : "Create movie scene"}
            </button>

            {scenePreview && (
              <section className="mt-8 border-t-2 border-ink/15 pt-6" aria-labelledby="review-scene-title">
                <figure className="mx-auto mb-5 w-full max-w-[250px] lg:hidden">
                  <figcaption className="mb-2 text-center font-mono text-[9px] font-bold uppercase text-pink">Generated movie scene</figcaption>
                  <div className="aspect-[9/16] overflow-hidden rounded-[22px] border-[3px] border-ink bg-ink shadow-[5px_6px_0_#ffe36e]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="size-full object-cover" src={scenePreview} alt="Generated movie scene" />
                  </div>
                </figure>
                <h2 className="font-display text-2xl font-normal" id="review-scene-title">3. Check the scene</h2>
                {!sceneApproved ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                    <button className="min-h-12 rounded-xl border-2 border-ink bg-yellow px-4 font-black shadow-[3px_3px_0_#241a44]" type="button" onClick={() => setSceneApproved(true)}>Use this scene</button>
                    <button className="min-h-12 rounded-xl border-2 border-ink bg-white px-4 font-black" type="button" disabled={busy} onClick={() => void generateScene()}>Make another</button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-black text-[#287a4b]">Scene approved ✓</p>
                )}
              </section>
            )}

            {sceneApproved && (
              <form className="mt-8 border-t-2 border-ink/15 pt-6" onSubmit={makeVideo}>
                <h2 className="font-display text-2xl font-normal">4. Animate it</h2>
                <div className="mt-4 rounded-xl border-2 border-ink/15 bg-white p-4">
                  <p className="font-mono text-[8px] font-black uppercase text-pink">Final moment</p>
                  <p className="mt-2 text-sm font-bold">{movie} · {scene}</p>
                  <p className="mt-2 text-sm font-black">“{dialogue}”</p>
                </div>

                <p className="mt-3 font-mono text-[9px] text-ink-muted">{saving ? "Saving draft…" : "Draft saved automatically"}</p>
                <button className="mt-4 min-h-12 w-full rounded-xl border-2 border-ink bg-yellow px-5 font-black shadow-[3px_3px_0_#241a44] disabled:opacity-45" type="submit" disabled={busy || !seedanceConfigured || !dialogue.trim()}>
                  {busy ? "Starting animation…" : "Animate with 1 credit"}
                </button>
              </form>
            )}
            {message && <p className="mt-5 rounded-xl border-2 border-[#d73b75] bg-[#fff0f5] px-4 py-3 text-sm font-extrabold text-[#8f1945]" role="alert">{message}</p>}
          </section>

          <section className="sticky top-6 hidden aspect-[9/16] overflow-hidden rounded-[30px] border-[3px] border-ink bg-ink shadow-[8px_9px_0_#ffe36e] lg:block">
            {scenePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="size-full object-cover" src={scenePreview} alt="Generated movie scene" />
            ) : (
              <div className="grid size-full place-items-center p-10 text-center font-display text-3xl text-cream">Your pet takes the starring role.</div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
