"use client";

import { toPng } from "html-to-image";
import { forwardRef } from "react";
import type { AcceptedAnalysis } from "@/lib/analysis/types";
import { getRarityTier } from "@/lib/rarity/score";

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

function Spark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 1.5c.7 6.3 4.2 9.8 10.5 10.5-6.3.7-9.8 4.2-10.5 10.5C11.3 16.2 7.8 12.7 1.5 12 7.8 11.3 11.3 7.8 12 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export const ShareCard = forwardRef<
  HTMLElement,
  { photo: string; result: AcceptedAnalysis; pending?: boolean }
>(function ShareCard({ photo, result, pending = false }, ref) {
  const petName = result.petName || "Your pet";
  const rarityTier = getRarityTier(result.rarityScore);
  const pendingPhrases: Record<string, string> = {
    aura: "Their Whole Mood",
    sceneLore: "The World Around Them",
    drama: "How Much This Matters",
    gaze: "What Has Their Attention",
  };

  return (
    <article
      className={`story-card story-card--rarity-${rarityTier}`}
      ref={ref}
    >
      <div className="story-holo" aria-hidden="true" />
      <header className="story-header">
        <div className="story-identity">
          <span>
            {petName.toUpperCase()} ·{" "}
            {(pending ? "PET" : result.species || "PET").toUpperCase()} ·{" "}
            {(pending ? "ONE PHOTO" : result.energy || "ONE OF ONE").toUpperCase()}
          </span>
          <h2>{pending ? "Their Story Starts Here" : result.cardTitle}</h2>
        </div>
        <div className="story-score">
          <span>RARITY</span>
          <strong>{pending ? "??" : result.rarityScore}</strong>
          <i><Spark /></i>
        </div>
      </header>
      <div className="story-portrait">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt={`${petName} in their rarity card photograph`} />
        <span className="story-spark story-spark-two"><Star /></span>
      </div>
      <section className="story-thought">
        <div className="story-thought-heading">
          <span>
            {pending ? "THEIR TAKE" : <>{petName.toUpperCase()}&apos;S TAKE</>}
          </span>
          <i aria-hidden="true"><Star /></i>
        </div>
        <h3>{pending ? "The Look You Know" : result.signatureRead.title}</h3>
        <p>
          {pending
            ? "You already know what this face means. Their card will put it into words."
            : result.signatureRead.thought}
        </p>
      </section>
      <div className="story-stats">
        {result.ratings.map((stat) => (
          <div className="story-stat" key={stat.key}>
            <div className="story-stat-heading"><span>{stat.label}</span></div>
            <p>
              {pending
                ? pendingPhrases[stat.key] || "Waiting For Their Read"
                : stat.phrase}
            </p>
          </div>
        ))}
      </div>
      <div className="story-footer">
        <span>ONE OF ONE · NOT BUILT TO BLEND IN.</span>
        <span>RLY · 2026</span>
      </div>
    </article>
  );
});

export type ShareAsset = { dataUrl: string; file: File };

export async function createShareAsset(card: HTMLElement): Promise<ShareAsset> {
  await Promise.all(
    Array.from(card.querySelectorAll("img")).map((image) =>
      image.complete ? Promise.resolve() : image.decode(),
    ),
  );
  const exportCard = card.cloneNode(true) as HTMLElement;
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
