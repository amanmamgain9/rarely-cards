import type { FormEventHandler, RefObject } from "react";
import { AppStepRail, AppWorkspaceHeader } from "@/components/rarity/app-workspace-header";
import { PetVoiceComposer } from "@/components/rarity/pet-voice-composer";
import type { PetDialogueSuggestion } from "@/lib/video/dialogue";

export function VoiceWorkspace({
  creditBalance,
  onSignOut,
  photo,
  petName,
  analysisId,
  dialogueSuggestions,
  selectedDialogue,
  onSelectDialogue,
  customDialogue,
  onCustomDialogueChange,
  suggestionsBusy,
  onRetrySuggestions,
  onSubmit,
  onRemovePhoto,
  uploadInput,
  message,
}: {
  creditBalance: number;
  onSignOut: () => void;
  photo: string | null;
  petName: string;
  analysisId: string | null;
  dialogueSuggestions: PetDialogueSuggestion[];
  selectedDialogue: string;
  onSelectDialogue: (line: string) => void;
  customDialogue: string;
  onCustomDialogueChange: (line: string) => void;
  suggestionsBusy: boolean;
  onRetrySuggestions: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onRemovePhoto: () => void;
  uploadInput: RefObject<HTMLInputElement | null>;
  message: string | null;
}) {
  const canSubmit = Boolean(
    analysisId && (customDialogue.trim() || selectedDialogue.trim()),
  );

  return (
    <>
      <AppWorkspaceHeader creditBalance={creditBalance} onSignOut={onSignOut} />
      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[920px] py-14 max-[700px]:w-[calc(100%-1.75rem)] max-[700px]:py-9" aria-labelledby="voice-step-title">
        <div className="flex items-end justify-between gap-7">
          <div>
            <span className="mb-2 block font-mono text-[10px] font-semibold tracking-widest text-pink">NEW VIDEO</span>
            <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight" id="voice-step-title">Choose a line</h1>
            <p className="mt-2 text-[15px] font-bold text-ink-muted">Select a suggestion or write exactly what your pet should say.</p>
          </div>
          <span className="rounded-lg bg-purple/15 px-3 py-2 font-mono text-[10px] text-ink-muted max-[700px]:hidden">1 credit used when you create the video</span>
        </div>

        <AppStepRail active={1} />

        <form className="grid items-start gap-7 rounded-2xl border border-ink/20 bg-cream p-6 shadow-xl shadow-ink/5 md:grid-cols-[minmax(230px,0.72fr)_minmax(0,1.28fr)] max-[700px]:p-4" onSubmit={onSubmit}>
          <div className="min-w-0">
            <figure className="relative m-0 h-[390px] w-full overflow-hidden rounded-2xl bg-[#ebe7ef] max-[700px]:h-[min(46vh,330px)]">
              {photo && (
                <>
                  {/* Account-scoped photos and local previews intentionally render directly. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="block size-full object-contain" src={photo} alt={`The selected photo of ${petName || "your pet"}`} />
                  <button
                    className="absolute right-3 top-3 grid size-11 place-items-center rounded-full border-2 border-ink bg-white text-2xl font-black leading-none text-ink shadow-[3px_3px_0_#241a44] transition hover:-translate-y-0.5 hover:bg-yellow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink"
                    type="button"
                    onClick={onRemovePhoto}
                    aria-label="Remove selected photo"
                    title="Remove photo"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </>
              )}
            </figure>
            <button className="mt-3 min-h-10 w-full rounded-lg border border-[#d8d1df] bg-white text-[11px] font-black text-ink-muted" type="button" onClick={() => uploadInput.current?.click()}>
              Choose a different photo
            </button>
          </div>

          <div className="min-w-0">
            <section aria-labelledby="workspace-lines-label">
              <div className="mb-3 flex items-center justify-between gap-3 font-mono text-[9px] uppercase text-ink-muted">
                <span className="font-bold" id="workspace-lines-label">Suggested lines</span>
                <small>Based on this photo</small>
              </div>
              <div className="grid gap-3" aria-live="polite">
                {suggestionsBusy && (
                  <>
                    <span className="h-24 animate-pulse rounded-xl bg-purple/10" />
                    <span className="h-24 animate-pulse rounded-xl bg-purple/10" />
                    <span className="h-24 animate-pulse rounded-xl bg-purple/10" />
                  </>
                )}
                {!suggestionsBusy && dialogueSuggestions.length === 0 && (
                  <div className="grid gap-3 rounded-xl border border-dashed border-ink/20 p-4 text-sm text-ink-muted">
                    <span>No suggestions were generated for this photo.</span>
                    <button className="w-fit rounded-lg border border-ink bg-white px-3 py-2 text-[10px] font-black text-ink" type="button" onClick={onRetrySuggestions}>Try again</button>
                  </div>
                )}
                {dialogueSuggestions.map((suggestion) => (
                  <button
                    className={`relative flex min-h-24 flex-col items-start gap-2 rounded-xl bg-white px-4 py-3 pr-9 text-left transition hover:border-purple ${selectedDialogue === suggestion.line ? "border-2 border-ink bg-yellow" : "border border-[#d8d1df]"}`}
                    type="button"
                    key={suggestion.tone}
                    onClick={() => onSelectDialogue(suggestion.line)}
                    aria-pressed={selectedDialogue === suggestion.line}
                  >
                    <small className="font-mono text-[9px] uppercase text-pink">{suggestion.tone}</small>
                    <span className="font-bold">“{suggestion.line}”</span>
                    <i className={`absolute right-3 top-3 not-italic ${selectedDialogue === suggestion.line ? "opacity-100" : "opacity-0"}`} aria-hidden="true">✓</i>
                  </button>
                ))}
              </div>
            </section>

            <div className="my-4 flex items-center gap-3 font-mono text-[8px] uppercase text-ink-muted before:h-px before:flex-1 before:bg-ink/15 after:h-px after:flex-1 after:bg-ink/15"><span>or add your own line</span></div>
            <PetVoiceComposer value={customDialogue} onChange={onCustomDialogueChange} />

            <button className="mt-4 min-h-12 w-full rounded-xl border-2 border-ink bg-pink font-black text-white shadow-[3px_3px_0_#241a44] disabled:cursor-not-allowed disabled:opacity-45" type="submit" disabled={!canSubmit}>
              {analysisId ? "Create video" : "Preparing photo…"}
            </button>
            {message && <p className="mt-5 rounded-lg border border-[#d73b75] bg-[#fff0f5] px-4 py-3 text-[13px] font-extrabold text-[#8f1945]" role="alert">{message}</p>}
          </div>
        </form>
      </section>
    </>
  );
}
