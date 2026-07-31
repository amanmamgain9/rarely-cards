import Link from "next/link";

export const metadata = {
  title: "Offline — Rarely",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="grid min-h-svh place-items-center gap-6 bg-cream px-5 py-16 text-center text-ink">
      <span className="rounded-md border-2 border-ink bg-yellow px-3 py-1 font-mono text-[9px] font-medium tracking-wide shadow-[3px_3px_0_#241a44]">CONNECTION PAUSED</span>
      <h1 className="m-0 max-w-3xl font-display text-[clamp(2.125rem,8vw,4.5rem)] leading-tight">Rare, but not available offline.</h1>
      <p className="mx-auto max-w-xl text-[clamp(1.05rem,3vw,1.375rem)] font-bold text-ink-muted">
        Rarely needs a connection to sign you in, read a pet photo, and keep
        purchases in sync.
      </p>
      <Link className="mt-2 rounded-full border-[3px] border-ink bg-yellow px-6 py-3 font-black shadow-[4px_5px_0_#241a44]" href="/">Try again</Link>
    </main>
  );
}
