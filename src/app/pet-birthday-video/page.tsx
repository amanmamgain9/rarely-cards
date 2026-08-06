import Link from "next/link";
import { InstagramBrowserHandoff } from "@/components/birthday/instagram-browser-handoff";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { intentMetadata } from "@/components/seo/intent-page";
import { petBirthdayVideo } from "@/lib/seo-intents";

export const metadata = intentMetadata(petBirthdayVideo);

const studioHref = "/studio/birthday?source=instagram-birthday-ad";

export default function PetBirthdayVideoPage() {
  return (
    <main className="min-h-svh overflow-hidden bg-[#fffaf1] text-ink">
      <InstagramBrowserHandoff />
      <div className="pt-6">
        <PublicHeader ctaHref={studioHref} ctaLabel="Make birthday video →" />
      </div>

      <header className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1120px] items-center gap-10 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:py-20 max-sm:w-[calc(100%-2rem)]">
        <div className="min-w-0">
          <h1 className="max-w-[700px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[0.91] tracking-[-0.045em]">
            <span className="block whitespace-nowrap">Personalized</span>
            <span className="block whitespace-nowrap text-pink">pet birthday</span>
            <span className="block whitespace-nowrap text-pink">video</span>
          </h1>
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link className="inline-flex min-h-14 items-center rounded-xl border-[3px] border-ink bg-pink px-6 py-3 font-black text-white shadow-[5px_6px_0_#241a44] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none" href={studioHref}>
              Make a birthday video →
            </Link>
          </div>
        </div>

        <figure className="relative mx-auto min-w-0 w-full max-w-[430px] max-sm:w-[calc(100%-1rem)]">
          <div className="absolute -left-4 -top-4 rounded-xl border-2 border-ink bg-yellow px-3 py-2 font-mono text-[9px] font-bold uppercase shadow-[3px_3px_0_#241a44]">Real Rarely result</div>
          <video className="aspect-[9/16] w-full rounded-[28px] border-[3px] border-ink bg-ink object-cover shadow-[9px_10px_0_#a98cf4]" controls playsInline preload="metadata" poster="/birthday/five-cats-demo-poster.jpg">
            <source src="/birthday/five-cats-demo.mp4" type="video/mp4" />
            Your browser does not support video playback.
          </video>
          <figcaption className="mt-4 text-center text-sm font-black text-ink-muted">Sound on.</figcaption>
        </figure>
      </header>

      <section className="border-y-[3px] border-ink bg-yellow" aria-labelledby="birthday-how-title">
        <div className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1120px] gap-5 py-8 md:grid-cols-[0.9fr_1.1fr] md:items-center lg:py-10 max-sm:w-[calc(100%-2rem)]">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.6rem)] font-normal leading-[0.98]" id="birthday-how-title">
            {petBirthdayVideo.proofTitle}
          </h2>
          <p className="m-0 max-w-2xl text-sm font-bold leading-relaxed text-ink-muted sm:text-base">
            {petBirthdayVideo.proofCopy}
          </p>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
