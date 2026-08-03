import { Film, Upload } from "@/components/rarity/rarity-icons";
import type { PublicVideoGeneration } from "@/lib/video/types";

type PetVideoPanelProps = {
  photo: string;
  petName: string;
  generation: PublicVideoGeneration | null;
  busy: boolean;
  shareBusy: boolean;
  message: string | null;
  onGenerate: () => void;
  onShare: () => void;
};

export function PetVideoPanel({
  photo,
  petName,
  generation,
  busy,
  shareBusy,
  message,
  onGenerate,
  onShare,
}: PetVideoPanelProps) {
  const making =
    busy || generation?.status === "submitting" || generation?.status === "running";
  const ready = generation?.status === "succeeded" && generation.videoUrl;
  const failed = generation?.status === "failed";

  return (
    <aside className="grid min-h-[640px] w-[min(360px,calc(100vw-1.5rem))] grid-rows-[366px_1fr] gap-4 rounded-[22px] border-[3px] border-ink bg-purple p-3.5 text-cream shadow-[7px_8px_0_#241a44]" aria-live="polite">
      <div className="grid h-[366px] min-w-0 grid-cols-[20px_minmax(0,206px)_20px] justify-center overflow-hidden rounded-xl border-2 border-ink bg-[#171020]">
        <span className="bg-cream/20" aria-hidden="true" />
        <div className="relative min-w-0 overflow-hidden border-x-2 border-cream bg-ink">
          {ready ? (
            <video
              src={generation.videoUrl || undefined}
              poster={photo}
              controls
              playsInline
              loop
              preload="metadata"
              className="block size-full object-cover"
              aria-label={`${petName}'s animated Rarely video`}
            />
          ) : (
            // Signed analysis URLs and blob previews are already handled by the app.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="block size-full object-cover" src={photo} alt="" />
          )}
          {!ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 bg-gradient-to-b from-transparent from-30% to-[#1a1024]/90 px-3 py-5 text-center">
              {making ? (
                <i className="grid size-12 place-items-center rounded-full border-2 border-ink bg-yellow shadow-[3px_3px_0_#f4458f]" aria-hidden="true">
                  <span className="size-7 animate-spin rounded-full border-[3px] border-ink/20 border-t-ink" />
                </i>
              ) : (
                <i className="grid size-11 place-items-center rounded-full border-2 border-ink bg-yellow text-ink shadow-[3px_3px_0_#f4458f] [&>svg]:w-6"><Film /></i>
              )}
              <small className="font-mono text-[7px] font-bold uppercase tracking-wider">{making ? "GENERATING VIDEO" : failed ? "GENERATION FAILED" : "VIDEO PREVIEW"}</small>
              <strong className="font-display text-[13px] font-normal leading-tight">
                {making
                  ? `Generating ${petName}'s video…`
                  : failed
                    ? "That video did not finish."
                    : "Ready to generate"}
              </strong>
            </div>
          )}
        </div>
        <span className="bg-cream/20" aria-hidden="true" />
      </div>

      <div className="flex min-w-0 flex-col items-center text-center">
        <span className="w-max rounded-md border-2 border-ink bg-yellow px-2 py-1 font-mono text-[7px] font-bold uppercase tracking-wider text-ink shadow-[2px_2px_0_#f4458f]">8 SECONDS · VERTICAL · WITH SOUND</span>
        <h2 className="mb-2 mt-3 font-display text-xl font-normal leading-none text-pink">{ready ? "VIDEO READY" : "CREATE VIDEO"}</h2>
        <p className="mx-1 mb-3 text-[11px] font-extrabold leading-snug">
          {ready
            ? "Share or download the finished video."
            : failed
              ? "Your video credit was returned. Start another video whenever you are ready."
              : "Review the photo and line, then create the video."}
        </p>
        {ready ? (
          <button className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 border-ink bg-pink pl-4 pr-2 font-display text-[9px] text-white shadow-[4px_4px_0_#ffe36e] disabled:cursor-wait disabled:opacity-70" type="button" onClick={onShare} disabled={shareBusy}>
            <span>{shareBusy ? "Preparing video…" : "Share video"}</span><i className="grid size-9 place-items-center rounded-lg border-2 border-ink bg-yellow text-ink [&>svg]:w-4"><Upload /></i>
          </button>
        ) : (
          <button className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 border-ink bg-pink pl-4 pr-2 font-display text-[9px] text-white shadow-[4px_4px_0_#ffe36e] disabled:cursor-wait disabled:opacity-70" type="button" onClick={onGenerate} disabled={making || failed}>
            <span>{making ? "Generating video…" : failed ? "Credit returned" : "Create video"}</span><i className="grid size-9 place-items-center rounded-lg border-2 border-ink bg-yellow text-ink [&>svg]:w-4"><Film /></i>
          </button>
        )}
        <small className="mt-2 font-mono text-[6.5px] font-bold uppercase leading-snug tracking-wider text-[#d7cce4]">
          {message || (making ? "Usually takes a few minutes · Safe to leave" : "Uses one video credit")}
        </small>
        {!generation && !making && (
          <small className="mt-2 text-[7.5px] font-bold leading-snug text-[#bfb0cf]">
            Generating sends this photo, pet details, and your chosen line to BytePlus for private
            AI video processing. <a className="text-yellow underline underline-offset-2" href="/privacy">How we handle it</a>
          </small>
        )}
      </div>
    </aside>
  );
}
