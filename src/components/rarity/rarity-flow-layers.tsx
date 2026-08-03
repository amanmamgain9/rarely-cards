import type { RefObject } from "react";
import { PetVideoPanel } from "@/components/rarity/pet-video-panel";
import type { FlowState } from "@/components/rarity/rarity-model";
import type { AcceptedAnalysis } from "@/lib/analysis/types";
import type { PublicVideoGeneration } from "@/lib/video/types";

type RarityFlowLayersProps = {
  flow: FlowState;
  photo: string | null;
  uploadInput: RefObject<HTMLInputElement | null>;
  message: string | null;
};

export function RarityFlowLayers({
  flow,
  photo,
  uploadInput,
  message,
}: RarityFlowLayersProps) {
  return (
    <>
      {flow === "processing" && photo && (
        <section className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-ink p-5 text-white" aria-live="polite">
          <div className="grid w-full max-w-4xl gap-7 rounded-3xl border-2 border-white/20 bg-white/5 p-6 md:grid-cols-[300px_1fr]">
            <div className="col-span-full flex justify-between gap-4 font-mono text-[9px] text-yellow">
              <span>VIDEO GENERATION</span>
              <span>PROCESSING</span>
            </div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border-2 border-yellow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="size-full object-cover" src={photo} alt="" />
              <div className="absolute inset-0 grid place-items-center bg-ink/35" aria-hidden="true">
                <span className="grid size-20 place-items-center rounded-full border-2 border-white/30 bg-ink/70">
                  <i className="size-11 animate-spin rounded-full border-[5px] border-white/20 border-t-yellow" />
                </span>
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-mono text-[9px] font-bold tracking-widest text-pink">PHOTO AND LINE RECEIVED</span>
              <h2 className="my-4 font-display text-[clamp(2.5rem,6vw,4rem)] font-normal leading-none">Preparing video</h2>
              <p className="font-bold leading-relaxed text-white/70">We’re reading the photo and preparing it for animation. Video generation can take a few minutes.</p>
              <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <span className="block h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-pink via-yellow to-purple" />
              </div>
              <small className="mt-4 font-mono text-[9px] leading-relaxed text-white/55">You can leave this page. The job is saved to your account and continues if your connection drops.</small>
            </div>
          </div>
        </section>
      )}

      {(flow === "retry" || flow === "refund_pending" || flow === "refunded") && (
        <section className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-ink/85 p-5 backdrop-blur-xl" aria-live="polite">
          <div className="w-full max-w-lg rounded-3xl border-4 border-ink bg-cream p-9 text-center shadow-[10px_11px_0_#f4458f,17px_18px_0_#ffe36e]">
            <span className="inline-flex rounded-md border-2 border-ink bg-yellow px-3 py-1 font-mono text-[9px] font-bold">
              {flow === "retry"
                ? "PHOTO COULD NOT BE USED · CREDIT RETURNED"
                : "PAYMENT UPDATE"}
            </span>
            <h2 className="my-5 font-display text-[clamp(2.375rem,8vw,3.625rem)] font-normal leading-none">
              {flow === "retry" ? "Choose another photo" : "Refund started"}
            </h2>
            <p className="mb-5 font-extrabold leading-relaxed text-ink-muted">{message}</p>
            {flow === "retry" && (
              <>
                <button className="min-h-12 rounded-xl border-2 border-ink bg-pink px-4 font-black text-white shadow-[3px_3px_0_#241a44]" type="button" onClick={() => uploadInput.current?.click()}>
                  Try another photo — no credit used
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
};

export function RarityResultScreen({
  flow,
  photo,
  result,
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
}: RarityResultScreenProps) {
  if (flow !== "completed" || !photo || !result) return null;

  return (
    <section className="fixed inset-0 z-[110] overflow-y-auto bg-ink text-cream" aria-label="Your talking-pet video">
      <div className="flex min-h-svh flex-col items-center justify-center gap-5 px-3 py-6">
        <div className="grid place-items-center">
          {seedanceConfigured && (
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
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-[9px] font-bold underline underline-offset-4 [&>a]:text-cream [&>button]:border-0 [&>button]:bg-transparent [&>button]:text-cream">
          <button type="button" onClick={() => uploadInput.current?.click()}>
            Make another video · {creditBalance} left
          </button>
          <a href="/studio">View all videos</a>
          <button type="button" onClick={onReturnHome}>Back to create</button>
        </div>
      </div>
    </section>
  );
}
