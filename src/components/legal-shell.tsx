import type { ReactNode } from "react";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";

export function LegalShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-svh bg-cream px-5 pb-20 pt-8 text-ink">
      <div className="mb-10">
        <PublicHeader />
      </div>
      {children}
      <div className="-mx-5 -mb-20 mt-20">
        <PublicFooter />
      </div>
    </main>
  );
}

export function LegalArticle({ children }: { children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-[820px] rounded-3xl border-4 border-ink bg-cream p-7 text-[15px] font-bold leading-7 text-ink-muted shadow-[9px_10px_0_#241a44,16px_17px_0_#f4458f] sm:p-12 lg:p-16">
      {children}
    </article>
  );
}

export function LegalEyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-md border-2 border-ink bg-yellow px-3 py-1 font-mono text-[9px] font-medium tracking-wide text-ink shadow-[3px_3px_0_#241a44]">
      {children}
    </span>
  );
}

export function LegalTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="my-6 font-display text-[clamp(2.5rem,8vw,4.375rem)] font-normal leading-[0.95] tracking-[-0.05em] text-ink">
      {children}
    </h1>
  );
}

export function LegalHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 mt-8 font-display text-lg font-normal leading-tight text-ink">
      {children}
    </h2>
  );
}
