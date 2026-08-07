import type { Metadata } from "next";
import Link from "next/link";
import {
  PaymentProcessorCopy,
  PricingIntroPaymentCopy,
  PricingTicketPrice,
} from "@/components/payments/pricing-payment-copy";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";

export const metadata: Metadata = {
  title: "Talking Pet Video Pricing — 3 Videos for $10 | Rarely",
  description: "Three AI talking-pet videos for $10. No subscription.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Talking Pet Video Pricing — 3 Videos for $10 | Rarely",
    description: "Get three AI talking-pet videos for $10. Pay once with no subscription.",
    url: "/pricing",
    siteName: "Rarely",
    type: "website",
    images: [{
      url: "/social/og-pricing.jpg",
      width: 1200,
      height: 630,
      alt: "Rarely pricing: three talking-pet videos for $10 with no subscription",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talking Pet Video Pricing — 3 Videos for $10 | Rarely",
    description: "Get three AI talking-pet videos for $10. Pay once with no subscription.",
    images: ["/social/og-pricing.jpg"],
  },
};

const included = [
  "3 videos with sound",
  "Suggested or custom lines",
  "Downloadable MP4s",
  "No subscription",
];

export default function PricingPage() {
  return (
    <main className="min-h-svh overflow-hidden bg-cream pt-7 text-ink">
      <PublicHeader />

      <section className="mx-auto grid w-[calc(100%-2.5rem)] max-w-6xl items-center gap-12 py-16 lg:grid-cols-[1fr_0.82fr] lg:gap-20 lg:py-24 max-sm:w-[calc(100%-1.75rem)]">
        <div>
          <h1 className="mb-6 max-w-3xl font-display text-[clamp(2.5rem,7vw,5.75rem)] font-normal leading-[0.94] tracking-[-0.055em]">
            Three videos.
            <br />
            <em className="not-italic text-pink [text-shadow:4px_4px_0_#ffe36e]">Pay once.</em>
          </h1>
          <PricingIntroPaymentCopy />
        </div>

        <aside className="rotate-1 border-4 border-ink bg-yellow p-6 shadow-[10px_11px_0_#241a44,18px_19px_0_#f4458f] max-lg:mx-auto max-lg:w-full max-lg:max-w-md" aria-label="Rarely talking-pet video price">
          <div className="flex justify-between gap-3 border-b-2 border-dashed border-ink pb-4 font-mono text-[8px] font-bold">
            <span>RARELY VIDEO PACK</span>
            <span>3 CREDITS</span>
          </div>
          <PricingTicketPrice />
          <ul className="grid list-none gap-3 border-y-2 border-dashed border-ink py-5">
            {included.map((item) => (
              <li className="flex items-center gap-3 text-sm font-extrabold" key={item}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs text-yellow" aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 text-center font-mono text-[10px] font-bold">$10 · 3 CREDITS · PAY ONCE</div>
        </aside>
      </section>

      <section className="border-y-[3px] border-ink bg-ink px-[max(1.5rem,calc((100vw-1120px)/2))] py-8 text-cream">
        <div className="grid gap-5 md:grid-cols-3 md:divide-x md:divide-white/25">
          <div className="md:pr-6">
            <strong className="block text-sm text-yellow">Private</strong>
            <span className="text-xs font-bold text-[#dcd2e8]">Only you can see your photos and videos.</span>
          </div>
          <div className="md:px-6">
            <strong className="block text-sm text-yellow">Credit protected</strong>
            <span className="text-xs font-bold text-[#dcd2e8]">Failed generations return the credit.</span>
          </div>
          <div className="md:pl-6">
            <strong className="block text-sm text-yellow">14-day refund</strong>
            <span className="text-xs font-bold text-[#dcd2e8]">
              <Link className="underline underline-offset-4" href="/refund-policy">Read the policy.</Link>
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-6xl py-8 max-sm:w-[calc(100%-1.75rem)]">
        <PaymentProcessorCopy />
      </section>

      <PublicFooter />
    </main>
  );
}
