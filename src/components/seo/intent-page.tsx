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
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}${intent.path}#app`,
        name: "Rarely",
        url: `${SITE_URL}${intent.path}`,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web, Android",
        description: intent.description,
        image: `${SITE_URL}/social/rarely-pets.jpg`,
        offers: {
          "@type": "Offer",
          price: "10",
          priceCurrency: "USD",
          description: "Three talking-pet video credits; one-time purchase",
          url: `${SITE_URL}/pricing`,
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}${intent.path}#faq`,
        mainEntity: intent.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Rarely", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: intent.title, item: `${SITE_URL}${intent.path}` },
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

export function IntentPage({ intent }: { intent: SeoIntent }) {
  return (
    <main className="min-h-svh overflow-hidden bg-soft-pink text-ink">
      <JsonLd intent={intent} />

      <div className="pt-7">
        <PublicHeader />
      </div>

      <section className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1180px] items-center gap-14 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-24 lg:py-28">
        <div className="min-w-0">
          <p className="mb-5 w-fit rotate-[-1deg] rounded-md border-2 border-ink bg-yellow px-3 py-2 font-mono text-[9px] font-bold uppercase shadow-[3px_3px_0_#241a44]">
            {intent.eyebrow}
          </p>
          <h1 className="max-w-4xl font-display text-[clamp(2.75rem,7vw,6.25rem)] font-normal leading-[0.9] tracking-[-0.055em]">
            {intent.headline}
            <span className="mt-2 block text-pink [text-shadow:5px_5px_0_#ffe36e]">{intent.accent}</span>
          </h1>
          <p className="my-7 max-w-2xl text-base font-extrabold leading-relaxed text-ink-muted sm:text-lg">
            {intent.intro}
          </p>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Link className="inline-flex min-h-12 items-center rounded-xl border-[3px] border-ink bg-pink px-5 py-3 font-mono text-[10px] font-bold uppercase text-white shadow-[4px_5px_0_#241a44] transition-transform hover:-translate-y-0.5 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-pink motion-reduce:transition-none" href="/#maker">
              Make my pet talk →
            </Link>
            <Link className="font-mono text-[10px] font-bold uppercase underline decoration-2 underline-offset-4" href="/pricing">
              3 videos · $10 · no subscription
            </Link>
          </div>
        </div>

        <figure className="relative mx-auto w-full max-w-[410px] rotate-1">
          <div className="absolute -left-5 -top-5 z-10 rotate-[-8deg] border-2 border-ink bg-cream px-3 py-2 font-mono text-[8px] font-bold shadow-[3px_3px_0_#241a44]">
            ONE PHOTO · ONE LINE
          </div>
          <div className="relative aspect-[9/13] overflow-hidden rounded-[28px] border-4 border-ink bg-purple shadow-[10px_11px_0_#241a44,18px_19px_0_#f4458f]">
            <Image src={intent.image} alt={intent.imageAlt} fill priority sizes="(max-width: 768px) 88vw, 410px" className="object-cover" />
            <div className="absolute inset-x-4 bottom-4 border-[3px] border-ink bg-yellow p-4 shadow-[4px_4px_0_#241a44]">
              <span className="mb-2 block font-mono text-[8px] font-bold uppercase">THEIR LINE / TAKE 01</span>
              <blockquote className="m-0 font-display text-[clamp(1.2rem,3vw,1.75rem)] font-normal leading-tight">“{intent.quote}”</blockquote>
            </div>
          </div>
        </figure>
      </section>

      <section className="border-y-[3px] border-ink bg-ink text-cream">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-20 lg:py-24">
          <div className="lg:sticky lg:top-8">
            <p className="font-mono text-[9px] font-bold uppercase text-pink">THE WHOLE PROCESS</p>
            <h2 className="my-5 font-display text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-none">Photo in.<br /><span className="text-yellow">Voice out.</span></h2>
            <p className="max-w-md font-bold leading-relaxed text-[#cdbfe0]">{intent.proofCopy}</p>
          </div>
          <ol className="m-0 list-none border-t-2 border-white/20 p-0">
            {intent.steps.map((step, index) => (
              <li className="grid grid-cols-[3rem_1fr] gap-5 border-b-2 border-white/20 py-7" key={step.title}>
                <span className="font-mono text-[10px] font-bold text-pink">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="mb-2 font-display text-xl font-normal text-yellow">{step.title}</h3>
                  <p className="m-0 text-sm font-bold leading-relaxed text-[#dcd2e8]">{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[1180px] py-20 lg:py-24">
        <div className="mb-10 max-w-3xl">
          <p className="font-mono text-[9px] font-bold uppercase text-pink">A GOOD PLACE TO START</p>
          <h2 className="my-4 font-display text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-none">{intent.ideasTitle}</h2>
          <p className="font-bold leading-relaxed text-ink-muted">{intent.ideasIntro}</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {intent.ideas.map((idea, index) => (
            <article className={`${index === 1 ? "bg-yellow" : index === 2 ? "bg-white" : "bg-cream"} rounded-2xl border-[3px] border-ink p-7 shadow-[6px_7px_0_#241a44]`} key={idea.title}>
              <span className="font-mono text-[9px] font-bold text-pink">PROMPT {String(index + 1).padStart(2, "0")}</span>
              <h3 className="mb-3 mt-5 font-display text-xl font-normal leading-tight">{idea.title}</h3>
              <p className="m-0 text-sm font-bold leading-relaxed text-ink-muted">{idea.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y-[3px] border-ink bg-cream">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-6 py-20 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20 lg:py-24">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase text-pink">BEFORE THE FIRST TAKE</p>
            <h2 className="my-4 font-display text-[clamp(2.5rem,5vw,4rem)] font-normal leading-none">Questions,<br />answered.</h2>
            <p className="font-bold leading-relaxed text-ink-muted">{intent.proofTitle}</p>
          </div>
          <div className="border-t-[3px] border-ink">
            {intent.faqs.map((faq) => (
              <details className="group border-b-[3px] border-ink py-5" key={faq.question}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-display text-lg font-normal marker:hidden">
                  {faq.question}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-yellow font-mono text-lg group-open:rotate-45 motion-reduce:transition-none">+</span>
                </summary>
                <p className="mb-1 mt-4 max-w-2xl pr-12 text-sm font-bold leading-relaxed text-ink-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-pink px-6 py-20 text-center text-white lg:py-24">
        <p className="font-mono text-[9px] font-bold uppercase text-yellow">THE PHOTO IS ALREADY IN YOUR CAMERA ROLL</p>
        <h2 className="mx-auto my-6 max-w-4xl font-display text-[clamp(2.75rem,6vw,5rem)] font-normal leading-none">Now let them say the thing.</h2>
        <Link className="inline-flex min-h-12 items-center rounded-xl border-[3px] border-ink bg-yellow px-5 py-3 font-mono text-[10px] font-bold uppercase text-ink shadow-[4px_5px_0_#241a44] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-yellow" href="/#maker">
          Choose a photo →
        </Link>
      </section>

      <PublicFooter />
    </main>
  );
}
