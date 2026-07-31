import type { Metadata } from "next";
import Link from "next/link";
import {
  PaymentProcessorCopy,
  PricingIntroPaymentCopy,
  PricingTicketPrice,
} from "@/components/pricing-payment-copy";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";

export const metadata: Metadata = {
  title: "Pricing — Rarely",
  description:
    "Three AI talking-pet videos for $10. No subscription.",
  alternates: {
    canonical: "/pricing",
  },
};

const included = [
  "Three eight-second vertical talking-pet videos with sound",
  "Three photo-specific dialogue suggestions before you spend a credit",
  "Custom speech up to 120 characters",
  "Share or save the finished MP4 from your phone",
];

export default function PricingPage() {
  return (
    <main className="min-h-svh overflow-hidden bg-cream pt-7 text-ink">
      <PublicHeader />

      <section className="mx-auto grid w-[calc(100%-2.5rem)] max-w-6xl items-center gap-14 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-24 lg:py-28">
        <div>
          <span className="inline-flex rounded-md border-2 border-ink bg-yellow px-3 py-1 font-mono text-[9px] font-medium tracking-wide shadow-[3px_3px_0_#241a44]">THREE PET VIDEOS · ONE PAYMENT</span>
          <h1 className="my-6 max-w-3xl font-display text-[clamp(3.25rem,7vw,5.75rem)] font-normal leading-[0.94] tracking-[-0.055em]">
            Three chances to hear
            <br />
            <em className="not-italic text-pink [text-shadow:4px_4px_0_#ffe36e]">their whole thing.</em>
          </h1>
          <PricingIntroPaymentCopy />
        </div>

        <aside className="rotate-1 border-4 border-ink bg-yellow p-5 shadow-[10px_11px_0_#241a44,18px_19px_0_#f4458f] max-lg:mx-auto max-lg:w-full max-lg:max-w-md" aria-label="Rarely talking-pet video price">
          <div className="flex justify-between gap-3 border-b-2 border-dashed border-ink pb-4 font-mono text-[8px] font-bold">
            <span>RLY / VIDEO THREE-PACK</span>
            <span>DIGITAL CREDITS</span>
          </div>
          <PricingTicketPrice />
          <p className="mb-4 text-center font-mono text-[11px] font-bold tracking-widest">3 VIDEO CREDITS · ONE-TIME PAYMENT</p>
          <ul className="grid list-none gap-3 border-y-2 border-dashed border-ink py-4">
            <li className="grid grid-cols-[28px_1fr] gap-2 text-[13px] font-extrabold"><span className="font-mono text-[10px]">01</span> Upload one pet photo</li>
            <li className="grid grid-cols-[28px_1fr] gap-2 text-[13px] font-extrabold"><span className="font-mono text-[10px]">02</span> Pick what they say</li>
            <li className="grid grid-cols-[28px_1fr] gap-2 text-[13px] font-extrabold"><span className="font-mono text-[10px]">03</span> Share their finished reel</li>
          </ul>
          <div className="mx-auto mt-5 w-fit -rotate-3 border-[3px] border-pink px-3 py-2 font-mono text-[10px] font-bold text-pink">NO SUBSCRIPTION</div>
        </aside>
      </section>

      <section className="grid gap-12 border-y-[3px] border-ink bg-ink px-[max(1.5rem,calc((100vw-1120px)/2))] py-20 text-cream lg:grid-cols-[0.75fr_1.25fr] lg:gap-20 lg:py-24">
        <div>
          <span className="font-mono text-[10px] font-bold tracking-wide text-pink">WHAT THREE CREDITS BUY</span>
          <h2 className="mt-4 font-display text-[clamp(2.5rem,5vw,4.125rem)] font-normal leading-none">Three photos or lines.<br /><em className="not-italic text-yellow">Three videos out.</em></h2>
        </div>
        <ol className="m-0 list-none p-0">
          {included.map((item, index) => (
            <li className="grid grid-cols-[52px_1fr] items-start gap-5 border-b-2 border-white/20 py-5" key={item}>
              <span className="font-mono text-[10px] font-bold tracking-wide text-pink">{String(index + 1).padStart(2, "0")}</span>
              <p className="m-0 text-lg font-extrabold leading-snug">{item}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid w-[calc(100%-2.5rem)] max-w-6xl gap-6 py-24 lg:grid-cols-3">
        <div className="rounded-2xl border-[3px] border-ink bg-cream p-7 shadow-[5px_6px_0_#241a44]">
          <span className="font-mono text-[10px] font-bold tracking-wide text-pink">PAYMENT</span>
          <h2 className="my-3 font-display text-xl font-normal leading-tight">What happens at checkout?</h2>
          <PaymentProcessorCopy />
        </div>
        <div className="rounded-2xl border-[3px] border-ink bg-cream p-7 shadow-[5px_6px_0_#241a44]">
          <span className="font-mono text-[10px] font-bold tracking-wide text-pink">DELIVERY</span>
          <h2 className="my-3 font-display text-xl font-normal leading-tight">What do I receive?</h2>
          <p className="m-0 text-sm font-bold leading-relaxed text-ink-muted">
            Each completed attempt produces an eight-second 9:16 talking-pet video
            with sound. Nothing physical is shipped. Videos and photos stay private
            in your account until you delete them.
          </p>
        </div>
        <div className="rounded-2xl border-[3px] border-ink bg-cream p-7 shadow-[5px_6px_0_#241a44]">
          <span className="font-mono text-[10px] font-bold tracking-wide text-pink">CREDIT USE</span>
          <h2 className="my-3 font-display text-xl font-normal leading-tight">When is a credit used?</h2>
          <p className="m-0 text-sm font-bold leading-relaxed text-ink-muted">
            One credit is reserved when you press “Make my pet talk.” Invalid files,
            rejected photos, and technical generation failures return it automatically.
            A completed video uses one credit. Purchases also have our{" "}
            <Link className="text-pink underline" href="/refund-policy">14-day full-refund guarantee</Link>.
          </p>
        </div>
      </section>

      <section className="border-y-[3px] border-ink bg-soft-pink px-5 py-24 text-center">
        <span className="font-mono text-[10px] font-bold">THREE PETS, THREE LINES, OR THREE VERSIONS OF THE SAME LITTLE WEIRDO.</span>
        <h2 className="mx-auto my-7 max-w-4xl font-display text-[clamp(2.375rem,6vw,4.5rem)] font-normal leading-none">Upload a photo. Pick the words. Watch them say it.</h2>
        <Link className="inline-flex rounded-xl border-[3px] border-ink bg-yellow px-5 py-3 font-mono text-[11px] font-bold shadow-[4px_5px_0_#241a44]" href="/#maker">Start with their photo →</Link>
      </section>

      <PublicFooter />
    </main>
  );
}
