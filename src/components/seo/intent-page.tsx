import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import type { SeoIntent } from "@/lib/seo-intents";
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
    </figure>
  );
}

export function IntentPage({ intent }: { intent: SeoIntent }) {
  return (
    <main className="min-h-svh overflow-hidden bg-[#f7f2e9] text-ink">
      <JsonLd intent={intent} />

      <div className="pt-6">
        <PublicHeader />
      </div>

      <article>
        <header className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1120px] items-center gap-14 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:py-24 max-sm:w-[calc(100%-1.75rem)]">
          <div className="min-w-0">
            <h1 className="max-w-3xl font-display text-[clamp(2.15rem,8.8vw,5.4rem)] font-normal leading-[0.91] tracking-[-0.045em]">
              {intent.title}
            </h1>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
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

        <section className="border-y-[3px] border-ink bg-yellow" aria-labelledby="how-it-works-title">
          <div className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1120px] gap-5 py-8 md:grid-cols-[0.9fr_1.1fr] md:items-center lg:py-10 max-sm:w-[calc(100%-1.75rem)]">
            <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.6rem)] font-normal leading-[0.98]" id="how-it-works-title">
              {intent.proofTitle}
            </h2>
            <p className="m-0 max-w-2xl text-sm font-bold leading-relaxed text-ink-muted sm:text-base">
              {intent.proofCopy}
            </p>
          </div>
        </section>

        <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[800px] py-14 lg:py-16 max-sm:w-[calc(100%-1.75rem)]" aria-labelledby="faq-title">
          <h2 className="mb-7 font-display text-[clamp(2rem,5vw,3rem)] font-normal leading-none" id="faq-title">Questions</h2>
          <div className="border-t-2 border-ink">
            {intent.faqs.slice(0, 3).map((faq) => (
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

      </article>

      <PublicFooter />
    </main>
  );
}
