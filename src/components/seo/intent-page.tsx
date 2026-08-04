import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { seoIntents, type SeoIntent } from "@/lib/seo-intents";
import { SITE_URL } from "@/lib/site";

export function intentMetadata(intent: SeoIntent): Metadata {
  return {
    title: `${intent.title} — Rarely`,
    description: intent.description,
    alternates: { canonical: intent.path },
    openGraph: {
      title: `${intent.title} — Rarely`,
      description: intent.description,
      url: intent.path,
      siteName: "Rarely",
      type: "website",
      images: [{
        url: "/social/rarely-pets.jpg",
        width: 1200,
        height: 630,
        alt: "Rarely AI talking-pet video examples",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${intent.title} — Rarely`,
      description: intent.description,
      images: ["/social/rarely-pets.jpg"],
    },
  };
}

function JsonLd({ intent }: { intent: SeoIntent }) {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}${intent.path}#page`,
        name: intent.title,
        url: `${SITE_URL}${intent.path}`,
        description: intent.description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#app` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: `${SITE_URL}${intent.image}`,
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: "Rarely",
        url: SITE_URL,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web, Android",
        description:
          "Create an eight-second talking-pet video from one cat or dog photo and a line you choose.",
        offers: {
          "@type": "Offer",
          price: "10",
          priceCurrency: "USD",
          description: "Three talking-pet video credits; one-time purchase",
          url: `${SITE_URL}/pricing`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Rarely", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
          { "@type": "ListItem", position: 3, name: intent.title, item: `${SITE_URL}${intent.path}` },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

function FilmFrame({ intent }: { intent: SeoIntent }) {
  return (
    <figure className="mx-auto w-full max-w-[430px]">
      <div className="grid aspect-[9/13] grid-cols-[20px_minmax(0,1fr)_20px] overflow-hidden rounded-[22px] border-[3px] border-ink bg-ink shadow-[8px_9px_0_#a98cf4]">
        <span className="film-perf bg-cream/15" aria-hidden="true" />
        <div className="relative overflow-hidden border-x-2 border-cream/80">
          <Image
            alt={intent.imageAlt}
            className="object-cover"
            fill
            priority
            sizes="(max-width: 768px) 88vw, 430px"
            src={intent.image}
          />
          <div className="absolute inset-x-4 bottom-4 border-2 border-ink bg-cream/95 p-4 shadow-[4px_4px_0_#241a44]">
            <span className="mb-2 block font-mono text-[8px] font-bold uppercase text-pink">
              Sample line
            </span>
            <blockquote className="m-0 text-base font-black leading-snug text-ink sm:text-lg">
              “{intent.quote}”
            </blockquote>
          </div>
        </div>
        <span className="film-perf bg-cream/15" aria-hidden="true" />
      </div>
      <figcaption className="mt-4 text-center font-mono text-[8px] font-bold uppercase tracking-wide text-ink-muted">
        One source photo · one chosen line · sound on
      </figcaption>
    </figure>
  );
}

export function IntentPage({ intent }: { intent: SeoIntent }) {
  const related = seoIntents
    .filter((candidate) => candidate.path !== intent.path)
    .slice(0, 3);

  return (
    <main className="min-h-svh overflow-hidden bg-[#f7f2e9] text-ink">
      <JsonLd intent={intent} />

      <div className="pt-6">
        <PublicHeader />
      </div>

      <article>
        <header className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1120px] items-center gap-14 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:py-24 max-sm:w-[calc(100%-1.75rem)]">
          <div className="min-w-0">
            <nav className="mb-7 font-mono text-[9px] font-bold uppercase text-ink-muted" aria-label="Breadcrumb">
              <Link className="hover:text-pink" href="/guides">Guides</Link>
              <span className="mx-2 text-pink" aria-hidden="true">/</span>
              <span>{intent.eyebrow}</span>
            </nav>
            <h1 className="max-w-3xl font-display text-[clamp(2.8rem,6vw,5.4rem)] font-normal leading-[0.91] tracking-[-0.045em]">
              {intent.headline}
              <span className="mt-2 block text-pink">{intent.accent}</span>
            </h1>
            <p className="my-7 max-w-2xl text-base font-bold leading-[1.7] text-ink-muted sm:text-lg">
              {intent.intro}
            </p>
            <div className="mb-8 flex flex-wrap gap-2 font-mono text-[8px] font-bold uppercase">
              {['8-second MP4', 'Voice + sound', 'Private by default'].map((fact) => (
                <span className="rounded-full border-2 border-ink/20 bg-white px-3 py-2" key={fact}>{fact}</span>
              ))}
            </div>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link className="inline-flex min-h-12 items-center rounded-xl border-[3px] border-ink bg-pink px-5 py-3 font-mono text-[10px] font-bold uppercase text-white shadow-[4px_5px_0_#241a44] transition-transform hover:-translate-y-0.5 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-pink motion-reduce:transition-none" href="/#maker">
                Choose a photo →
              </Link>
              <Link className="font-mono text-[9px] font-bold uppercase underline decoration-2 underline-offset-4" href="/pricing">
                3 videos · $10 · no subscription
              </Link>
            </div>
          </div>

          <FilmFrame intent={intent} />
        </header>

        <section className="border-y-[3px] border-ink bg-ink text-cream" aria-labelledby="process-title">
          <div className="mx-auto grid max-w-[1120px] gap-12 px-6 py-16 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20 lg:py-20">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase text-pink">How it works</p>
              <h2 className="my-5 font-display text-[clamp(2.35rem,5vw,4rem)] font-normal leading-none" id="process-title">
                {intent.proofTitle}
              </h2>
              <p className="max-w-md font-bold leading-[1.7] text-[#dcd2e8]">{intent.proofCopy}</p>
            </div>
            <ol className="m-0 list-none border-t border-white/25 p-0">
              {intent.steps.map((step, index) => (
                <li className="grid grid-cols-[2.5rem_1fr] gap-5 border-b border-white/25 py-7" key={step.title}>
                  <span className="font-mono text-[9px] font-bold text-pink">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="mb-2 text-lg font-black text-yellow">{step.title}</h3>
                    <p className="m-0 max-w-xl text-sm font-bold leading-[1.7] text-[#dcd2e8]">{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1120px] gap-12 py-16 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20 lg:py-20 max-sm:w-[calc(100%-1.75rem)]" aria-labelledby="field-notes-title">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase text-pink">Practical guide</p>
            <h2 className="my-4 font-display text-[clamp(2.35rem,5vw,4rem)] font-normal leading-none" id="field-notes-title">
              {intent.notesTitle}
            </h2>
            <p className="font-bold leading-[1.7] text-ink-muted">{intent.notesIntro}</p>
          </div>
          <div className="border-t-2 border-ink">
            {intent.notes.map((note) => (
              <section className="grid gap-3 border-b-2 border-ink py-6 sm:grid-cols-[10rem_1fr] sm:gap-7" key={note.title}>
                <h3 className="m-0 text-base font-black">{note.title}</h3>
                <p className="m-0 text-sm font-bold leading-[1.75] text-ink-muted">{note.copy}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="border-y-[3px] border-ink bg-white" aria-labelledby="ideas-title">
          <div className="mx-auto w-[calc(100%-2.5rem)] max-w-[1120px] py-16 lg:py-20 max-sm:w-[calc(100%-1.75rem)]">
            <div className="mb-9 max-w-3xl">
              <p className="font-mono text-[9px] font-bold uppercase text-pink">Ideas worth trying</p>
              <h2 className="my-4 font-display text-[clamp(2.35rem,5vw,4rem)] font-normal leading-none" id="ideas-title">{intent.ideasTitle}</h2>
              <p className="font-bold leading-[1.7] text-ink-muted">{intent.ideasIntro}</p>
            </div>
            <div className="grid border-y-2 border-ink lg:grid-cols-3">
              {intent.ideas.map((idea, index) => (
                <section className="border-ink py-6 not-last:border-b-2 lg:px-7 lg:first:pl-0 lg:last:pr-0 lg:not-last:border-b-0 lg:not-last:border-r-2" key={idea.title}>
                  <span className="font-mono text-[8px] font-bold text-pink">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mb-3 mt-4 text-lg font-black leading-tight">{idea.title}</h3>
                  <p className="m-0 text-sm font-bold leading-[1.7] text-ink-muted">{idea.copy}</p>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1120px] gap-12 py-16 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20 lg:py-20 max-sm:w-[calc(100%-1.75rem)]" aria-labelledby="faq-title">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase text-pink">Before you make one</p>
            <h2 className="my-4 font-display text-[clamp(2.35rem,5vw,3.8rem)] font-normal leading-none" id="faq-title">Questions,<br />answered.</h2>
          </div>
          <div className="border-t-2 border-ink">
            {intent.faqs.map((faq) => (
              <details className="group border-b-2 border-ink py-5" key={faq.question}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-black marker:hidden">
                  {faq.question}
                  <span className="text-xl font-black text-pink group-open:rotate-45 motion-reduce:transition-none">+</span>
                </summary>
                <p className="mb-1 mt-4 max-w-2xl pr-10 text-sm font-bold leading-[1.75] text-ink-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <nav className="border-t-[3px] border-ink bg-yellow" aria-label="Related talking-pet guides">
          <div className="mx-auto max-w-[1120px] px-6 py-14">
            <p className="font-mono text-[9px] font-bold uppercase">More talking-pet guides</p>
            <div className="mt-6 grid border-y-2 border-ink md:grid-cols-3">
              {related.map((candidate) => (
                <Link className="border-ink py-5 text-base font-black hover:text-pink md:px-5 md:first:pl-0 md:last:pr-0 md:not-last:border-r-2" href={candidate.path} key={candidate.path}>
                  {candidate.title} <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <section className="bg-pink px-6 py-16 text-center text-white lg:py-20">
          <h2 className="mx-auto max-w-4xl font-display text-[clamp(2.5rem,6vw,4.6rem)] font-normal leading-none">Use the photo you already love.</h2>
          <Link className="mt-7 inline-flex min-h-12 items-center rounded-xl border-[3px] border-ink bg-yellow px-5 py-3 font-mono text-[10px] font-bold uppercase text-ink shadow-[4px_5px_0_#241a44] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-yellow" href="/#maker">
            Make the video →
          </Link>
        </section>
      </article>

      <PublicFooter />
    </main>
  );
}
