import type {
  FormEventHandler,
  RefObject,
} from "react";
import Link from "next/link";
import { ShareCard } from "@/components/share-card";
import { PetVideoPanel } from "@/components/rarity/pet-video-panel";
import { Printer, Upload } from "@/components/rarity/rarity-icons";
import type { FlowState } from "@/components/rarity/rarity-model";
import type { AcceptedAnalysis } from "@/lib/analysis/types";
import type { PublicVideoGeneration } from "@/lib/video/types";
import type { PaymentChannel } from "@/lib/payments/use-payment-channel";

type RarityFlowLayersProps = {
  flow: FlowState;
  photo: string | null;
  petName: string;
  busyLabel: string;
  busyCopy: string;
  progressStage: number;
  checkoutPromptOpen: boolean;
  checkoutPrice: string | null;
  checkoutBusy: boolean;
  analysisId: string | null;
  checkoutAvailable: boolean;
  onStartCheckout: () => void;
  paymentChannel: PaymentChannel;
  googlePlayConfigured: boolean;
  uploadInput: RefObject<HTMLInputElement | null>;
  onCloseCheckout: () => void;
  message: string | null;
  onCloseNaming: () => void;
  onSubmitPetName: FormEventHandler<HTMLFormElement>;
  petNameInput: RefObject<HTMLInputElement | null>;
  onPetNameChange: (petName: string) => void;
  petPronouns: "he" | "she" | "they";
  onPetPronounsChange: (pronouns: "he" | "she" | "they") => void;
  legacyCardMode: boolean;
};

export function RarityFlowLayers({
  flow,
  photo,
  petName,
  busyLabel,
  busyCopy,
  progressStage,
  checkoutPromptOpen,
  checkoutPrice,
  checkoutBusy,
  analysisId,
  checkoutAvailable,
  onStartCheckout,
  paymentChannel,
  googlePlayConfigured,
  uploadInput,
  onCloseCheckout,
  message,
  onCloseNaming,
  onSubmitPetName,
  petNameInput,
  onPetNameChange,
  petPronouns,
  onPetPronounsChange,
  legacyCardMode,
}: RarityFlowLayersProps) {
  return (
    <>
      {flow === "restoring" && (
        <section className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-ink/85 p-5 backdrop-blur-xl" aria-live="polite">
          <div className="w-full max-w-lg rounded-3xl border-4 border-ink bg-cream p-9 text-center shadow-[10px_11px_0_#f4458f,17px_18px_0_#ffe36e]">
            <span className="inline-flex rounded-md border-2 border-ink bg-yellow px-3 py-1 font-mono text-[9px] font-bold">YOUR PHOTO IS SAFE</span>
            <h2 className="my-5 font-display text-[clamp(2.375rem,8vw,3.625rem)] font-normal leading-none">PICKING UP<br /><em className="not-italic text-pink">WHERE YOU LEFT OFF.</em></h2>
            <p className="font-extrabold text-ink-muted">Restoring their photo and the next step of their video.</p>
          </div>
        </section>
      )}

      {["verifying", "processing"].includes(flow) && photo && (
        <section className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-ink p-5 text-white" aria-live="polite">
          <div className="grid w-full max-w-4xl gap-6 rounded-3xl border-2 border-white/20 bg-white/5 p-6 md:grid-cols-[300px_1fr]">
            <div className="col-span-full flex justify-between gap-4 font-mono text-[9px] text-yellow">
              <span>RLY / VIDEO STUDIO</span>
              <span>
                {flow === "processing"
                  ? "1 CREDIT RESERVED · MAKING THEIRS"
                  : "PAYMENT COMPLETE · ADDING 3 CREDITS"}
              </span>
            </div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border-2 border-yellow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="size-full object-cover" src={photo} alt="" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-mono text-[9px] font-bold tracking-widest text-pink">
                {flow === "processing" ? "THEIR VIDEO IS UNDERWAY" : "PAYMENT RECEIVED"}
              </span>
              <h2 className="my-4 font-display text-[clamp(2.5rem,6vw,4rem)] font-normal leading-none">{busyLabel}<i>...</i></h2>
              <p className="font-bold leading-relaxed text-white/70">{busyCopy}</p>
              <div className="mt-6 grid gap-3">
                {["Confirm credit", "Make their video"].map((step, index) => (
                  <div
                    className={`flex items-center gap-3 rounded-lg border p-3 font-mono text-[10px] ${index < progressStage ? "border-pink bg-pink text-white" : index === progressStage ? "border-yellow bg-yellow text-ink" : "border-white/20 text-white/50"}`}
                    key={step}
                  >
                    <span>0{index + 1}</span><b>{step}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {flow === "checkout" && checkoutPromptOpen && photo && (
        <section className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-ink/85 p-5 backdrop-blur-xl" aria-label="Make your pet talk">
          <div className="grid w-full max-w-4xl gap-8 rounded-3xl border-4 border-ink bg-cream p-8 shadow-[10px_11px_0_#f4458f,17px_18px_0_#ffe36e] md:grid-cols-[0.8fr_1.2fr]">
            <figure className="relative m-0 aspect-[4/5] overflow-hidden rounded-2xl border-[3px] border-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="size-full object-cover" src={photo} alt={`The photo you chose of ${petName || "your pet"}`} />
              <figcaption className="absolute bottom-3 left-3 rounded bg-yellow px-3 py-2 font-mono text-[8px] font-bold">THIS IS THE ONE <span>★</span></figcaption>
            </figure>
            <div className="flex flex-col justify-center text-center md:text-left">
              <span className="font-mono text-[9px] font-bold text-pink">
                PHOTO READY · THREE VIDEOS
                {checkoutPrice ? ` FOR ${checkoutPrice.toUpperCase()}` : ""}
              </span>
              <h2 className="my-4 font-display text-[clamp(2.5rem,6vw,4rem)] font-normal leading-none">MAKE THEM<br /><em className="not-italic text-pink">SAY THE THING.</em></h2>
              <p className="mb-5 font-extrabold leading-relaxed text-ink-muted">
                Three eight-second talking-pet videos. Pick the words; Rarely
                handles the performance, voice, and camera.
              </p>
              <button
                type="button"
                className="min-h-12 rounded-xl border-2 border-ink bg-pink px-5 font-black text-white shadow-[3px_3px_0_#241a44] disabled:opacity-50"
                disabled={checkoutBusy || !analysisId || !checkoutAvailable}
                onClick={onStartCheckout}
              >
                {checkoutBusy
                  ? "Opening checkout…"
                  : !analysisId || paymentChannel === "loading"
                    ? "Preparing secure checkout…"
                    : !checkoutAvailable
                      ? "Video checkout temporarily unavailable"
                    : paymentChannel === "play_unavailable"
                      ? "Google Play Billing unavailable"
                      : paymentChannel === "google_play" && !googlePlayConfigured
                        ? "Google Play checkout temporarily unavailable"
                        : `Pay${checkoutPrice ? ` ${checkoutPrice}` : ""} · Get 3 videos`}
              </button>
              {paymentChannel === "play_unavailable" && (
                <small className="mt-3 text-ink-muted">
                  Update Chrome or reopen Rarely from Google Play. Web checkout
                  is disabled inside the Android app.
                </small>
              )}
              <small className="mt-3 text-ink-muted">One-time payment · No subscription · Buy another pack anytime</small>
              <button type="button" className="mt-4 border-0 bg-transparent text-xs font-black underline" onClick={() => uploadInput.current?.click()}>
                Choose a different photo
              </button>
              <button type="button" className="mt-2 border-0 bg-transparent text-xs font-black underline" onClick={onCloseCheckout}>
                Not now
              </button>
              {message && <strong className="mt-3 text-sm text-[#8f1945]" role="alert">{message}</strong>}
            </div>
          </div>
        </section>
      )}

      {flow === "naming" && legacyCardMode && (
        <section className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-ink/85 p-5 backdrop-blur-xl" aria-label="Choose what your pet says">
          <div className="relative w-full max-w-lg rounded-3xl border-4 border-ink bg-cream p-9 text-center shadow-[10px_11px_0_#f4458f,17px_18px_0_#ffe36e]">
            <button
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border-2 border-ink bg-white [&_svg]:w-4 [&_svg]:stroke-ink [&_svg]:stroke-2"
              type="button"
              onClick={onCloseNaming}
              aria-label="Close line picker"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            <span className="inline-flex rounded-md border-2 border-ink bg-yellow px-3 py-1 font-mono text-[9px] font-bold">LEGACY CARD CREDIT · READY</span>
            <h2 className="my-5 font-display text-[clamp(2.375rem,8vw,3.625rem)] font-normal leading-none">WHAT DO THEY<br /><em className="not-italic text-pink">ANSWER TO?</em></h2>
            <p className="font-extrabold leading-relaxed text-ink-muted">Use one of your existing card credits. Your original Rarely card experience stays intact.</p>
            <form className="mt-5 grid gap-3" onSubmit={onSubmitPetName}>
              <input
                className="min-h-12 rounded-xl border-2 border-ink bg-white px-4 outline-none focus:border-purple"
                ref={petNameInput}
                type="text"
                value={petName}
                onChange={(event) => onPetNameChange(event.target.value)}
                placeholder="Their name (optional)"
                maxLength={30}
                autoComplete="off"
                autoFocus
              />
              <label className="grid gap-2 text-left font-mono text-[9px] uppercase text-ink-muted">
                <span>Pronouns</span>
                <select
                  className="min-h-12 rounded-xl border-2 border-ink bg-white px-4 font-sans text-sm font-bold normal-case text-ink"
                  value={petPronouns}
                  onChange={(event) =>
                    onPetPronounsChange(event.target.value as "he" | "she" | "they")
                  }
                >
                  <option value="they">They / them</option>
                  <option value="she">She / her</option>
                  <option value="he">He / him</option>
                </select>
              </label>
              <button
                className="min-h-12 rounded-xl border-2 border-ink bg-pink px-4 font-black text-white shadow-[3px_3px_0_#241a44] disabled:opacity-50"
                type="submit"
                disabled={!analysisId}
              >
                {analysisId ? "Make their card →" : "Preparing their photo…"}
              </button>
              <button type="button" className="border-0 bg-transparent text-xs font-black underline" onClick={() => uploadInput.current?.click()}>
                Use a different photo
              </button>
            </form>
            {message && <strong className="mt-3 block text-sm text-[#8f1945]" role="alert">{message}</strong>}
          </div>
        </section>
      )}

      {(flow === "retry" || flow === "refund_pending" || flow === "refunded") && (
        <section className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-ink/85 p-5 backdrop-blur-xl" aria-live="polite">
          <div className="w-full max-w-lg rounded-3xl border-4 border-ink bg-cream p-9 text-center shadow-[10px_11px_0_#f4458f,17px_18px_0_#ffe36e]">
            <span className="inline-flex rounded-md border-2 border-ink bg-yellow px-3 py-1 font-mono text-[9px] font-bold">
              {flow === "retry"
                ? legacyCardMode
                  ? "AI RESPONSE COMPLETE · 1 LEGACY CREDIT USED"
                  : "PHOTO COULD NOT BE USED · CREDIT RETURNED"
                : "PAYMENT UPDATE"}
            </span>
            <h2 className="my-5 font-display text-[clamp(2.375rem,8vw,3.625rem)] font-normal leading-none">
              {flow === "retry" ? <>WE NEED MORE<br /><em className="not-italic text-pink">OF THEM.</em></> : <>REFUND<br /><em className="not-italic text-pink">STARTED.</em></>}
            </h2>
            <p className="mb-5 font-extrabold leading-relaxed text-ink-muted">{message}</p>
            {flow === "retry" && (
              <>
                <button className="min-h-12 rounded-xl border-2 border-ink bg-pink px-4 font-black text-white shadow-[3px_3px_0_#241a44]" type="button" onClick={() => uploadInput.current?.click()}>
                  {legacyCardMode
                    ? "Try another photo — uses 1 legacy credit"
                    : "Try another photo — your credit is ready"}
                </button>
                <a className="mt-4 block text-xs font-black underline" href="/account">View credits and purchases</a>
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
}

type RarityResultScreenProps = {
  flow: FlowState;
  photo: string | null;
  result: AcceptedAnalysis | null;
  exportCardRef: RefObject<HTMLElement | null>;
  onShare: () => void;
  shareBusy: boolean;
  shareLabel: string;
  zazzlePrintEnabled: boolean;
  onOrderPrint: () => void;
  printBusy: boolean;
  printLabel: string;
  creditBalance: number;
  uploadInput: RefObject<HTMLInputElement | null>;
  onReturnHome: () => void;
  seedanceConfigured: boolean;
  videoGeneration: PublicVideoGeneration | null;
  videoBusy: boolean;
  videoShareBusy: boolean;
  videoMessage: string | null;
  onGenerateVideo: () => void;
  onShareVideo: () => void;
  legacyCardMode: boolean;
};

export function RarityResultScreen({
  flow,
  photo,
  result,
  exportCardRef,
  onShare,
  shareBusy,
  shareLabel,
  zazzlePrintEnabled,
  onOrderPrint,
  printBusy,
  printLabel,
  creditBalance,
  uploadInput,
  onReturnHome,
  seedanceConfigured,
  videoGeneration,
  videoBusy,
  videoShareBusy,
  videoMessage,
  onGenerateVideo,
  onShareVideo,
  legacyCardMode,
}: RarityResultScreenProps) {
  if (flow !== "completed" || !photo || !result) return null;

  return (
    <section className="fixed inset-0 z-[110] overflow-y-auto bg-ink text-cream" aria-label={legacyCardMode ? "Your legacy Rarely card" : "Your talking-pet video"}>
      <div className="flex min-h-svh flex-col items-center justify-center gap-5 px-3 py-6">
        <div className="grid place-items-center">
          {!legacyCardMode && seedanceConfigured && (
            <PetVideoPanel
              photo={photo}
              petName={result.petName || "Your pet"}
              generation={videoGeneration}
              busy={videoBusy}
              shareBusy={videoShareBusy}
              message={videoMessage}
              onGenerate={onGenerateVideo}
              onShare={onShareVideo}
            />
          )}
          {legacyCardMode && (
            <div className="grid place-items-center gap-4">
              <span className="rounded-md border-2 border-cream bg-pink px-3 py-1 font-mono text-[9px] font-bold">LEGACY · THEIR RARELY CARD</span>
              <ShareCard photo={photo} result={result} ref={exportCardRef} />
            </div>
          )}
        </div>
        {legacyCardMode && (
          <div className="flex flex-wrap justify-center gap-4">
            <button className="flex min-h-12 min-w-56 items-center justify-between rounded-xl border-2 border-ink bg-pink px-5 font-display text-[10px] text-white shadow-[4px_4px_0_#ffe36e]" type="button" onClick={onShare} disabled={shareBusy}>
              <span>{shareLabel}</span><i className="[&>svg]:w-5"><Upload /></i>
            </button>
            {zazzlePrintEnabled && (
              <>
                <button
                  className="flex min-h-12 min-w-56 items-center justify-between rounded-xl border-2 border-ink bg-yellow px-5 font-display text-[10px] text-ink shadow-[4px_4px_0_#f4458f]"
                  type="button"
                  onClick={onOrderPrint}
                  disabled={shareBusy || printBusy}
                >
                  <span>{printLabel}</span><i className="[&>svg]:w-5"><Printer /></i>
                </button>
                <small className="w-full text-center font-mono text-[8px] text-white/60">
                  Printing, payment, and delivery by Zazzle
                </small>
              </>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-[9px] font-bold underline underline-offset-4 [&>a]:text-cream [&>button]:border-0 [&>button]:bg-transparent [&>button]:text-cream">
          {legacyCardMode && creditBalance === 0 ? (
            <Link href="/">Make a talking-pet video</Link>
          ) : (
            <button type="button" onClick={() => uploadInput.current?.click()}>
              {legacyCardMode ? "Make another legacy card" : "Make another video"} · {creditBalance} left
            </button>
          )}
          <a href="/account">{legacyCardMode ? "View my account" : "View all my videos"}</a>
          <button type="button" onClick={onReturnHome}>Back to homepage</button>
        </div>
      </div>
    </section>
  );
}
