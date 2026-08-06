import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { seoIntents } from "@/lib/seo-intents";

export const metadata: Metadata = {
  title: "Talking Pet Video Guides — Rarely",
  description:
    "Practical guides for making talking-cat, talking-dog, personalized pet, and pet birthday videos from one photo.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Talking Pet Video Guides — Rarely",
    description:
      "Choose a clear pet photo, write a line that fits, and make a better talking-pet video.",
    url: "/guides",
    siteName: "Rarely",
    type: "website",
    images: ["/social/rarely-pets.jpg"],
  },
};

export default function GuidesPage() {
  return (
    <main className="min-h-svh bg-[#f7f2e9] text-ink">
      <div className="pt-6">
        <PublicHeader />
      </div>

      <header className="mx-auto w-[calc(100%-2.5rem)] max-w-[1120px] py-14 lg:py-20 max-sm:w-[calc(100%-1.75rem)]">
        <h1 className="max-w-4xl font-display text-[clamp(2.7rem,7vw,5.5rem)] font-normal leading-[0.9] tracking-[-0.045em]">
          Talking pet<br /><span className="text-pink">video guides.</span>
        </h1>
      </header>

      <section className="border-y-[3px] border-ink bg-white" aria-labelledby="guides-list-title">
        <div className="mx-auto w-[calc(100%-2.5rem)] max-w-[1120px] py-16 lg:py-20 max-sm:w-[calc(100%-1.75rem)]">
          <h2 className="sr-only" id="guides-list-title">Talking-pet video guides</h2>
          <div className="grid gap-x-8 gap-y-12 md:grid-cols-2">
            <article className="group relative grid min-w-0 gap-5 border-t-2 border-ink pt-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <div className="relative h-40 min-w-0 overflow-hidden rounded-xl border-2 border-ink bg-yellow sm:aspect-square sm:h-auto">
                <Image
                  alt=""
                  className="object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                  fill
                  sizes="144px"
                  src="/social/rarely-pets.jpg"
                />
              </div>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-black leading-tight">
                  <Link className="after:absolute after:inset-0 hover:text-pink" href="/guides/pet-video-accents">How to choose your pet&apos;s AI voice accent</Link>
                </h2>
                <p className="mt-3 text-sm font-bold leading-snug text-ink-muted">Hear the four available voice accents.</p>
                <span className="mt-4 inline-block font-mono text-[8px] font-bold uppercase text-pink">Read guide →</span>
              </div>
            </article>
            {seoIntents.map((intent) => (
              <article className="group relative grid min-w-0 gap-5 border-t-2 border-ink pt-5 sm:grid-cols-[9rem_minmax(0,1fr)]" key={intent.path}>
                <div className="relative h-40 min-w-0 overflow-hidden rounded-xl border-2 border-ink bg-purple sm:aspect-square sm:h-auto">
                  <Image
                    alt=""
                    className="object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                    fill
                    sizes="144px"
                    src={intent.image}
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-black leading-tight">
                    <Link className="after:absolute after:inset-0 hover:text-pink" href={intent.path}>{intent.title}</Link>
                  </h2>
                  <p className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-ink-muted">{intent.description}</p>
                  <span className="mt-4 inline-block font-mono text-[8px] font-bold uppercase text-pink">Read guide →</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-yellow" aria-labelledby="better-video-title">
        <div className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1120px] gap-5 py-9 md:grid-cols-[0.9fr_1.1fr] md:items-center lg:py-11 max-sm:w-[calc(100%-1.75rem)]">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.6rem)] font-normal leading-[0.98]" id="better-video-title">
            How to make a better talking pet video
          </h2>
          <p className="m-0 max-w-2xl text-sm font-bold leading-relaxed text-ink-muted sm:text-base">
            Start with one clear cat or dog photo, keep the face visible, and use a short line that fits the expression. These guides cover voice accents, birthday videos, and personalized pet videos.
          </p>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
