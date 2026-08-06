import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { SITE_URL } from "@/lib/site";

const path = "/guides/pet-video-accents";

export const metadata: Metadata = {
  title: "Talking Pet Video Voice Accents — Rarely",
  description:
    "Learn how to create an AI talking-pet video and choose a British English, American, neutral English, or French voice accent.",
  alternates: { canonical: path },
  openGraph: {
    title: "Talking Pet Video Voice Accents — Rarely",
    description:
      "Choose British English, American, neutral English, or French for your talking-pet video.",
    url: path,
    siteName: "Rarely",
    type: "article",
    publishedTime: "2026-08-04T00:00:00.000Z",
    modifiedTime: "2026-08-06T00:00:00.000Z",
    images: [
      {
        url: "/social/og-voice-accents.jpg",
        width: 1200,
        height: 630,
        alt: "Four voice accent options for a Rarely talking-pet video",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talking Pet Video Voice Accents — Rarely",
    description:
      "Create a talking-pet video with a British English, American, neutral English, or French accent.",
    images: ["/social/og-voice-accents.jpg"],
  },
};

const accents = [
  {
    name: "British English",
    line: "I believe dinner is running rather late.",
    note: "Dry and formal",
    color: "bg-yellow",
    turn: "-rotate-1",
  },
  {
    name: "American",
    line: "Okay, hear me out: second breakfast.",
    note: "Direct and lively",
    color: "bg-soft-pink",
    turn: "rotate-1",
  },
  {
    name: "Neutral English",
    line: "I have reviewed the situation. More snacks.",
    note: "Clear and flexible",
    color: "bg-cream",
    turn: "rotate-0",
  },
  {
    name: "French",
    line: "The cushion is mine. This is not negotiable.",
    note: "Warm and characterful",
    color: "bg-purple",
    turn: "-rotate-1",
  },
] as const;

export default function PetVideoAccentsGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Talking pet video voice accents",
    description: metadata.description,
    datePublished: "2026-08-04",
    dateModified: "2026-08-06",
    image: `${SITE_URL}/social/og-voice-accents.jpg`,
    mainEntityOfPage: `${SITE_URL}${path}`,
    author: { "@type": "Organization", name: "Rarely" },
    publisher: { "@type": "Organization", name: "Rarely" },
  };

  return (
    <main className="min-h-svh bg-cream text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <div className="bg-purple pt-6">
        <PublicHeader />

        <header className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1120px] gap-12 py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-24 max-sm:w-[calc(100%-1.75rem)]">
          <div>
            <h1 className="max-w-3xl font-display text-[clamp(2.7rem,7vw,6rem)] font-normal leading-[0.88] tracking-[-0.045em] text-cream [text-shadow:4px_5px_0_#241a44]">
              Talking pet video voice accents
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link className="inline-flex min-h-12 items-center rounded-xl border-[3px] border-ink bg-yellow px-5 py-3 font-mono text-[10px] font-bold uppercase shadow-[4px_5px_0_#241a44] transition hover:-translate-y-0.5 focus-visible:outline-pink motion-reduce:transition-none" href="/#maker">
                Make my pet talk →
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md pb-7 lg:mr-0" aria-hidden="true">
            <div className="absolute -left-5 -top-5 size-20 rounded-full border-[3px] border-ink bg-pink" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border-[4px] border-ink bg-yellow shadow-[12px_14px_0_#241a44]">
              <Image
                alt=""
                className="object-cover"
                fill
                priority
                sizes="(max-width: 1024px) 448px, 420px"
                src="/pets/window-cat.jpg"
              />
            </div>
            <div className="absolute -bottom-1 -left-5 max-w-[15rem] rotate-[-3deg] rounded-[1.4rem_1.4rem_1.4rem_0.25rem] border-[3px] border-ink bg-cream px-5 py-4 shadow-[5px_6px_0_#241a44]">
              <p className="font-black leading-tight">“I was promised a voice worthy of this face.”</p>
            </div>
          </div>
        </header>
      </div>

      <article>
        <section className="border-y-[3px] border-ink bg-ink text-cream" aria-labelledby="accent-lineup">
          <div className="mx-auto w-[calc(100%-2.5rem)] max-w-[1120px] py-16 lg:py-20 max-sm:w-[calc(100%-1.75rem)]">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="max-w-3xl font-display text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[0.95]" id="accent-lineup">
                Pick their voice.
              </h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {accents.map((accent) => (
                <section className={`${accent.color} ${accent.turn} rounded-2xl border-[3px] border-cream p-6 text-ink shadow-[6px_7px_0_#f4458f] transition hover:rotate-0 motion-reduce:transition-none`} key={accent.name}>
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-display text-2xl font-normal">{accent.name}</h3>
                    <span className="font-mono text-[8px] font-bold uppercase">{accent.note}</span>
                  </div>
                  <blockquote className="mt-5 border-l-[3px] border-ink pl-4 text-lg font-black leading-snug">“{accent.line}”</blockquote>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b-[3px] border-ink bg-yellow" aria-labelledby="choose-accent-title">
          <div className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1120px] gap-5 py-9 md:grid-cols-[0.9fr_1.1fr] md:items-center lg:py-11 max-sm:w-[calc(100%-1.75rem)]">
            <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.6rem)] font-normal leading-[0.98]" id="choose-accent-title">
              How to choose a voice accent for a talking pet video
            </h2>
            <p className="m-0 max-w-2xl text-sm font-bold leading-relaxed text-ink-muted sm:text-base">
              Use British English, American, neutral English, or French. The selected accent changes the delivery; the words you enter stay the same.
            </p>
          </div>
        </section>

        <section className="bg-white" aria-labelledby="accent-faq">
          <div className="mx-auto w-[calc(100%-2.5rem)] max-w-[800px] py-14 lg:py-16 max-sm:w-[calc(100%-1.75rem)]">
            <h2 className="font-display text-[clamp(2rem,5vw,3rem)] font-normal leading-none" id="accent-faq">Good to know</h2>
            <div className="mt-7 border-t-2 border-ink">
              {[
                ["Do accents change my words?", "No. Your line stays the same."],
                ["Can French speak an English line?", "Yes. It changes the delivery, not the language."],
                ["What is neutral English?", "Clear English without a strong regional accent."],
              ].map(([question, answer]) => (
                <details className="group border-b-2 border-ink py-5" key={question}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black marker:hidden">
                    {question}<span className="text-xl text-pink group-open:rotate-45">+</span>
                  </summary>
                  <p className="mb-0 mt-3 text-sm font-bold text-ink-muted">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </article>

      <PublicFooter />
    </main>
  );
}
