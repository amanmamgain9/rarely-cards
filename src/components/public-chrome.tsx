import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="mx-auto grid min-h-20 w-[calc(100%-2.5rem)] max-w-[1180px] grid-cols-[auto_1fr_auto] items-center gap-7 rounded-2xl border-[3px] border-ink bg-cream/95 px-5 py-3 shadow-[6px_7px_0_#241a44] max-[900px]:grid-cols-[1fr_auto] max-[600px]:w-[calc(100%-1.75rem)] max-[600px]:gap-3 max-[600px]:px-3">
      <Link className="font-display text-2xl leading-none text-pink [text-shadow:2px_2px_0_#ffe36e] max-[600px]:text-xl" href="/">RARELY <span className="text-yellow">★</span></Link>
      <nav className="flex flex-wrap items-center justify-center gap-5 font-mono text-[10px] font-medium uppercase text-ink-muted max-[900px]:hidden" aria-label="Primary navigation">
        <Link href="/pricing">Pricing</Link>
        <Link href="/refund-policy">Refunds</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/contact">Contact</Link>
      </nav>
      <Link className="hidden min-h-10 items-center justify-center rounded-xl border-2 border-ink bg-yellow px-4 font-mono text-[10px] font-bold text-ink shadow-[3px_3px_0_#241a44] sm:inline-flex" href="/#maker">Make my pet talk →</Link>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="grid min-h-28 w-full grid-cols-[auto_1fr_auto] items-center gap-7 border-t-[3px] border-ink bg-ink px-[max(1.5rem,calc((100vw-1180px)/2))] py-7 text-cream max-[700px]:grid-cols-1 max-[700px]:justify-items-center max-[700px]:gap-4">
      <Link className="font-display text-2xl leading-none text-pink [text-shadow:2px_2px_0_#ffe36e]" href="/">RARELY <span className="text-yellow">★</span></Link>
      <p className="m-0 text-center font-mono text-[9px] text-[#cdbfe0]">© 2026 Rarely · Operated by Aman Mamgain, sole proprietor.</p>
      <nav className="flex flex-wrap justify-end gap-3 font-mono text-[9px] font-bold uppercase text-yellow max-[700px]:justify-center" aria-label="Legal navigation">
        <Link href="/pricing">Pricing</Link>
        <Link href="/refund-policy">Refunds</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </footer>
  );
}
