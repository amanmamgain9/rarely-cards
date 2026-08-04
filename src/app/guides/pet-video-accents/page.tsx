import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { SITE_URL } from "@/lib/site";

const path = "/guides/pet-video-accents";

export const metadata: Metadata = {
  title: "AI Talking Pet Videos With Different Accents — Rarely",
  description:
    "Learn how to create an AI talking-pet video and choose a British English, American, neutral English, or French voice accent.",
  alternates: { canonical: path },
  openGraph: {
    title: "Which accent sounds like your pet?",
    description:
      "Turn one pet photo into a talking video, then choose the voice delivery that fits their personality.",
    url: path,
    siteName: "Rarely",
    type: "article",
    publishedTime: "2026-08-04T00:00:00.000Z",
    modifiedTime: "2026-08-04T00:00:00.000Z",
    images: [
      {
        url: "/social/rarely-pets.jpg",
        width: 1200,
        height: 630,
        alt: "A cat and dog ready to become AI talking-pet videos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Which accent sounds like your pet?",
    description:
      "Create a talking-pet video with a British English, American, neutral English, or French accent.",
    images: ["/social/rarely-pets.jpg"],
  },
};

const accents = [
  {
    name: "British English",
    line: "I believe dinner is running rather late.",
    note: "A natural British delivery for dry observations, tiny formal complaints, and pets with excellent standards.",
    color: "bg-yellow",
    turn: "-rotate-1",
  },
  {
    name: "American",
    line: "Okay, hear me out: second breakfast.",
    note: "A contemporary American delivery that suits direct jokes, energetic greetings, and group-chat announcements.",
    color: "bg-soft-pink",
    turn: "rotate-1",
  },
  {
    name: "Neutral English",
    line: "I have reviewed the situation. More snacks.",
    note: "Clear English without a strongly regional sound—a flexible choice when the words should lead the performance.",
    color: "bg-cream",
    turn: "rotate-0",
  },
  {
    name: "French",
    line: "The cushion is mine. This is not negotiable.",
    note: "A contemporary French accent that adds character while keeping the exact line you wrote in its original language.",
    color: "bg-purple",
    turn: "-rotate-1",
  },
] as const;

const steps = [
  {
    number: "01",
    title: "Choose one clear photo",
    copy: "Use a cat or dog photo with the eyes and muzzle visible. A familiar expression gives the voice something believable to finish.",
  },
  {
    number: "02",
    title: "Write the line they would say",
    copy: "Keep it to one short sentence. Rarely can suggest lines from the photo, or you can write the exact joke, greeting, or demand yourself.",
  },
  {
    number: "03",
    title: "Cast the voice accent",
    copy: "Choose British English, American, neutral English, or French. The words stay the same; the selected accent guides how the finished voice sounds.",
  },
] as const;

export default function PetVideoAccentsGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How to create an AI talking-pet video with the right accent",
    description: metadata.description,
    datePublished: "2026-08-04",
    dateModified: "2026-08-04",
    image: `${SITE_URL}/social/rarely-pets.jpg`,
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
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
              Rarely field guide · Voice casting
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-[clamp(3rem,7vw,6.4rem)] font-normal leading-[0.88] tracking-[-0.045em] text-cream [text-shadow:4px_5px_0_#241a44]">
              Which accent sounds like your pet?
            </h1>
            <p className="mt-7 max-w-2xl text-lg font-black leading-[1.65] text-ink">
              Turn one cat or dog photo into a tiny talking video, then choose a British English, American, neutral English, or French voice accent to fit the performance.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link className="inline-flex min-h-12 items-center rounded-xl border-[3px] border-ink bg-yellow px-5 py-3 font-mono text-[10px] font-bold uppercase shadow-[4px_5px_0_#241a44] transition hover:-translate-y-0.5 focus-visible:outline-pink motion-reduce:transition-none" href="/#maker">
                Make my pet talk →
              </Link>
              <span className="font-mono text-[9px] font-bold uppercase">One photo · Your words · Four accents</span>
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
            <p className="font-mono text-[9px] font-bold uppercase text-yellow">The voice lineup</p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
              <h2 className="max-w-3xl font-display text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[0.95]" id="accent-lineup">
                Same pet. Same words. A different delivery.
              </h2>
              <p className="max-w-sm text-sm font-bold leading-relaxed text-[#d9cfe8]">
                An accent changes the flavor of the performance, not your script. Rarely tells the video model to preserve the line exactly as you entered it.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {accents.map((accent) => (
                <section className={`${accent.color} ${accent.turn} rounded-2xl border-[3px] border-cream p-6 text-ink shadow-[6px_7px_0_#f4458f] transition hover:rotate-0 motion-reduce:transition-none`} key={accent.name}>
                  <p className="font-mono text-[9px] font-bold uppercase">Accent option</p>
                  <h3 className="mt-2 font-display text-2xl font-normal">{accent.name}</h3>
                  <blockquote className="mt-5 border-l-[3px] border-ink pl-4 text-lg font-black leading-snug">“{accent.line}”</blockquote>
                  <p className="mt-5 text-sm font-bold leading-[1.65] text-ink-muted">{accent.note}</p>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-cream" aria-labelledby="make-video">
          <div className="mx-auto w-[calc(100%-2.5rem)] max-w-[960px] py-16 lg:py-24 max-sm:w-[calc(100%-1.75rem)]">
            <p className="font-mono text-[9px] font-bold uppercase text-pink">From photo to performance</p>
            <h2 className="mt-4 max-w-3xl font-display text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[0.95]" id="make-video">
              How to create an AI talking video of your pet
            </h2>
            <div className="mt-12 grid gap-8">
              {steps.map((step) => (
                <section className="grid gap-4 border-t-[3px] border-ink pt-5 sm:grid-cols-[5rem_1fr]" key={step.number}>
                  <span className="font-display text-3xl text-pink" aria-hidden="true">{step.number}</span>
                  <div>
                    <h3 className="text-xl font-black">{step.title}</h3>
                    <p className="mt-2 max-w-2xl text-base font-bold leading-[1.7] text-ink-muted">{step.copy}</p>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y-[3px] border-ink bg-yellow">
          <div className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1120px] gap-8 py-14 md:grid-cols-[1fr_auto] md:items-center max-sm:w-[calc(100%-1.75rem)]">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase text-pink">A useful casting rule</p>
              <h2 className="mt-3 max-w-3xl font-display text-[clamp(2rem,4vw,3.5rem)] font-normal leading-none">
                Choose the accent that makes the line feel most like them.
              </h2>
              <p className="mt-4 max-w-2xl font-bold leading-relaxed text-ink-muted">
                Try American for an outgoing announcement, neutral English when clarity matters most, British English for a drier delivery, or French when that character fits the moment. There is no “correct” voice—only the one your group chat recognizes.
              </p>
            </div>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-xl border-[3px] border-ink bg-pink px-6 py-3 font-mono text-[10px] font-bold uppercase text-white shadow-[4px_5px_0_#241a44] transition hover:-translate-y-0.5 focus-visible:outline-purple motion-reduce:transition-none" href="/#maker">
              Create a talking-pet video →
            </Link>
          </div>
        </section>

        <section className="bg-white" aria-labelledby="accent-faq">
          <div className="mx-auto w-[calc(100%-2.5rem)] max-w-[800px] py-16 lg:py-20 max-sm:w-[calc(100%-1.75rem)]">
            <h2 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-normal leading-none" id="accent-faq">A few voice notes</h2>
            <div className="mt-9 grid gap-8">
              <section>
                <h3 className="text-lg font-black">Does the accent rewrite or translate my line?</h3>
                <p className="mt-2 font-bold leading-relaxed text-ink-muted">No. Your chosen words stay the same. The accent selection guides the delivery of that line.</p>
              </section>
              <section>
                <h3 className="text-lg font-black">Can I use an English line with the French accent?</h3>
                <p className="mt-2 font-bold leading-relaxed text-ink-muted">Yes. The French option requests a French-accented delivery without translating the text you supplied.</p>
              </section>
              <section>
                <h3 className="text-lg font-black">What does neutral English mean?</h3>
                <p className="mt-2 font-bold leading-relaxed text-ink-muted">It asks for clear English without a strongly regional accent, so the words and your pet&apos;s expression remain the focus.</p>
              </section>
            </div>
          </div>
        </section>
      </article>

      <PublicFooter />
    </main>
  );
}
