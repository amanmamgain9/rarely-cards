"use client";

import Image from "next/image";
import { forwardRef } from "react";
import type { AcceptedAnalysis } from "@/lib/analysis/types";

function Star() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 1.5 2.65 7.22 7.65.28-6.02 4.73 2.1 7.35L12 16.8l-6.38 4.28 2.1-7.35L1.7 9l7.65-.28L12 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export const ShareCard = forwardRef<
  HTMLElement,
  {
    photo: string;
    result: AcceptedAnalysis;
    pending?: boolean;
    photoPriority?: boolean;
  }
>(function ShareCard(
  { photo, result, pending = false, photoPriority = false },
  ref,
) {
  const petName = result.petName || "Your pet";
  const isOptimizableDemo = photo.startsWith("/pets/");
  const pendingPhrases: Record<string, string> = {
    aura: "Their Whole Mood",
    sceneLore: "The World Around Them",
    drama: "How Much This Matters",
    gaze: "What Has Their Attention",
  };

  return (
    <article
      className="relative grid aspect-[9/16] w-[min(360px,calc(100vw-1.5rem))] grid-rows-[52px_minmax(0,1fr)_94px_108px_14px] gap-2 overflow-hidden rounded-[22px] border-[3px] border-ink bg-yellow p-3 text-ink shadow-[7px_8px_0_#241a44]"
      ref={ref}
    >
      <div className="story-holo pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-purple/20" aria-hidden="true" />
      <header className="relative z-10 flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="block truncate font-mono text-[6px] font-bold uppercase">
            {petName.toUpperCase()} ·{" "}
            {(pending ? "PET" : result.species || "PET").toUpperCase()} ·{" "}
            {(pending ? "ONE PHOTO" : result.energy || "ONE OF ONE").toUpperCase()}
          </span>
          <h2 className="truncate font-display text-[13px] font-normal">{pending ? "Their Story Starts Here" : result.cardTitle}</h2>
        </div>
        <div className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-ink bg-cream">
          <span className="font-mono text-[5px]">RARITY</span>
          <strong className="font-display text-lg leading-none">{pending ? "??" : result.rarityScore}</strong>
        </div>
      </header>
      <div className="relative z-10 overflow-hidden rounded-xl border-[3px] border-pink bg-purple shadow-[0_0_16px_#f4458f]">
        {isOptimizableDemo ? (
          <Image
            className="object-cover"
            src={photo}
            alt={`${petName} in their rarity card photograph`}
            fill
            sizes={photoPriority ? "(max-width: 760px) 88vw, 42vw" : "240px"}
            fetchPriority={photoPriority ? "high" : "auto"}
            loading={photoPriority ? "eager" : "lazy"}
          />
        ) : (
          // Blob and signed storage URLs are already resized by the app pipeline.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="size-full object-cover"
            src={photo}
            alt={`${petName} in their rarity card photograph`}
            width={720}
            height={1280}
            loading={photoPriority ? "eager" : "lazy"}
            fetchPriority={photoPriority ? "high" : "auto"}
          />
        )}
        <span className="absolute bottom-3 right-3 w-6 text-yellow drop-shadow-[2px_2px_0_#241a44]"><Star /></span>
      </div>
      <section className="relative z-10 rounded-xl border-2 border-ink bg-cream p-2">
        <div className="flex items-center justify-between font-mono text-[6px] font-bold text-pink">
          <span>
            {pending ? "THEIR TAKE" : <>{petName.toUpperCase()}&apos;S TAKE</>}
          </span>
          <i className="w-3" aria-hidden="true"><Star /></i>
        </div>
        <h3 className="my-1 font-display text-[11px] font-normal">{pending ? "The Look You Know" : result.signatureRead.title}</h3>
        <p className="line-clamp-3 text-[7px] font-bold leading-tight text-ink-muted">
          {pending
            ? "You already know what this face means. Their card will put it into words."
            : result.signatureRead.thought}
        </p>
      </section>
      <div className="relative z-10 grid grid-cols-2 gap-1.5">
        {result.ratings.map((stat) => (
          <div className="rounded-lg border border-ink bg-cream px-2 py-1" key={stat.key}>
            <div className="font-mono text-[5px] font-bold uppercase text-pink"><span>{stat.label}</span></div>
            <p className="mt-0.5 line-clamp-2 text-[6px] font-bold leading-tight">
              {pending
                ? pendingPhrases[stat.key] || "Waiting For Their Read"
                : stat.phrase}
            </p>
          </div>
        ))}
      </div>
      <div className="relative z-10 flex items-center justify-between font-mono text-[6px] font-bold">
        <span>ONE OF ONE · NOT BUILT TO BLEND IN.</span>
        <span>RLY · 2026</span>
      </div>
    </article>
  );
});

export type ShareAsset = { dataUrl: string; file: File };

export function downloadShareAsset(asset: ShareAsset, filename: string) {
  const downloadUrl = URL.createObjectURL(asset.file);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
}

export function canUseNativeFileShare(file: File) {
  return (
    navigator.maxTouchPoints > 0 &&
    Boolean(navigator.share) &&
    Boolean(navigator.canShare?.({ files: [file] }))
  );
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("card_photo_read_failed"));
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

async function loadEmbeddedImage(image: HTMLImageElement) {
  if (!image.complete) await image.decode();
  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    throw new Error("card_photo_decode_failed");
  }

  const response = await fetch(image.currentSrc || image.src, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("card_photo_fetch_failed");

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("card_photo_type_invalid");
  }
  return blobToDataUrl(blob);
}

export async function createShareAsset(card: HTMLElement): Promise<ShareAsset> {
  const { toPng } = await import("html-to-image");
  const sourceImages = Array.from(card.querySelectorAll("img"));
  const embeddedImages = await Promise.all(sourceImages.map(loadEmbeddedImage));
  const exportCard = card.cloneNode(true) as HTMLElement;
  Array.from(exportCard.querySelectorAll("img")).forEach((image, index) => {
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.src = embeddedImages[index];
  });
  exportCard.classList.add("story-card-export");
  Object.assign(exportCard.style, {
    position: "fixed",
    top: "0",
    left: "-10000px",
    width: "360px",
    height: "640px",
  });
  document.body.appendChild(exportCard);
  let dataUrl: string;
  try {
    await Promise.all(
      Array.from(exportCard.querySelectorAll("img")).map(async (image) => {
        await image.decode();
        if (image.naturalWidth === 0 || image.naturalHeight === 0) {
          throw new Error("card_photo_embed_failed");
        }
      }),
    );
    dataUrl = await toPng(exportCard, {
      width: 360,
      height: 640,
      canvasWidth: 1080,
      canvasHeight: 1920,
      pixelRatio: 1,
      cacheBust: true,
      backgroundColor: "#FFE36E",
      filter: (node) =>
        !(node instanceof HTMLElement && node.classList.contains("story-holo")),
    });
  } finally {
    exportCard.remove();
  }
  const blob = await fetch(dataUrl).then((response) => response.blob());
  return {
    dataUrl,
    file: new File([blob], "rarely-card.png", { type: "image/png" }),
  };
}
