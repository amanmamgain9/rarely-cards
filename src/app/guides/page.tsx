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

      <header className="mx-auto w-[calc(100%-2.5rem)] max-w-[1120px] py-16 lg:py-24 max-sm:w-[calc(100%-1.75rem)]">
        <p className="font-mono text-[9px] font-bold uppercase text-pink">Rarely field guides</p>
        <h1 className="mt-5 max-w-4xl font-display text-[clamp(3rem,7vw,6rem)] font-normal leading-[0.9] tracking-[-0.045em]">
          Better photos.<br /><span className="text-pink">Better pet videos.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-lg font-bold leading-[1.7] text-ink-muted">
          Practical advice for choosing the source photo, writing a line that fits the moment, and making a talking-pet video worth keeping.
        </p>
      </header>

      <section className="border-y-[3px] border-ink bg-white" aria-labelledby="guides-list-title">
        <div className="mx-auto w-[calc(100%-2.5rem)] max-w-[1120px] py-16 lg:py-20 max-sm:w-[calc(100%-1.75rem)]">
          <h2 className="sr-only" id="guides-list-title">Talking-pet video guides</h2>
          <div className="grid gap-x-8 gap-y-12 md:grid-cols-2">
            {seoIntents.map((intent) => (
              <article className="group relative grid gap-5 border-t-2 border-ink pt-5 sm:grid-cols-[9rem_1fr]" key={intent.path}>
                <div className="relative aspect-square overflow-hidden rounded-xl border-2 border-ink bg-purple">
                  <Image
                    alt=""
                    className="object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                    fill
                    sizes="144px"
                    src={intent.image}
                  />
                </div>
                <div>
                  <h2 className="text-xl font-black leading-tight">
                    <Link className="after:absolute after:inset-0 hover:text-pink" href={intent.path}>{intent.title}</Link>
                  </h2>
                  <p className="mt-3 text-sm font-bold leading-[1.65] text-ink-muted">{intent.description}</p>
                  <span className="mt-4 inline-block font-mono text-[8px] font-bold uppercase text-pink">Read guide →</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-yellow px-6 py-16 text-center">
        <h2 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-normal leading-none">Already have the photo?</h2>
        <Link className="mt-7 inline-flex min-h-12 items-center rounded-xl border-[3px] border-ink bg-pink px-5 py-3 font-mono text-[10px] font-bold uppercase text-white shadow-[4px_5px_0_#241a44]" href="/#maker">
          Make the video →
        </Link>
      </section>

      <PublicFooter />
    </main>
  );
}
