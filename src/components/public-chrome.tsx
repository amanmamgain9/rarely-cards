import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="public-nav">
      <Link className="public-brand" href="/">RARELY <span>★</span></Link>
      <nav aria-label="Primary navigation">
        <Link href="/pricing">Pricing</Link>
        <Link href="/refund-policy">Refunds</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/contact">Contact</Link>
      </nav>
      <Link className="public-nav-cta" href="/#maker">Make a card →</Link>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <Link className="public-brand" href="/">RARELY <span>★</span></Link>
      <p>© 2026 Rarely · Operated by Aman Mamgain, sole proprietor.</p>
      <nav aria-label="Legal navigation">
        <Link href="/pricing">Pricing</Link>
        <Link href="/refund-policy">Refunds</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </footer>
  );
}
