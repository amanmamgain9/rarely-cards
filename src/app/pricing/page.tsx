import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing — Rarely",
  description:
    "Five AI pet-card credits for one $5 USD payment. No subscription.",
  alternates: {
    canonical: "/pricing",
  },
};

const included = [
  "Five AI card attempts for cat or dog photos",
  "A name, title, rarity tier, signature trait, and imagined inner voice",
  "A polished 9:16 image for every completed card",
  "Private saved photos and cards in your Rarely account",
];

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <header className="public-nav">
        <Link className="public-brand" href="/">
          RARELY <span>★</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link aria-current="page" href="/pricing">Pricing</Link>
          <Link href="/refund-policy">Refunds</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <Link className="public-nav-cta" href="/#maker">Make a card →</Link>
      </header>

      <section className="pricing-hero">
        <div className="pricing-intro">
          <span className="pixel-label">FIVE CARD CREDITS · ONE PAYMENT</span>
          <h1>
            Five chances to catch
            <br />
            <em>their whole thing.</em>
          </h1>
          <p>
            One $5 pack adds five AI pet-card credits to your account. Use them
            now or later, buy another pack whenever you want, and never worry
            about a subscription.
          </p>
          <Link className="pricing-primary-cta" href="/#maker">
            Get 5 card credits — $5 <span>→</span>
          </Link>
        </div>

        <aside className="price-ticket" aria-label="Rarely card price">
          <div className="ticket-topline">
            <span>RLY / FIVE-PACK</span>
            <span>DIGITAL CREDITS</span>
          </div>
          <div className="ticket-price">
            <span>$</span>
            <strong>5</strong>
            <small>USD</small>
          </div>
          <p>5 CREDITS · ONE-TIME PAYMENT</p>
          <ul>
            <li><span>01</span> Buy five card credits</li>
            <li><span>02</span> Upload one pet per attempt</li>
            <li><span>03</span> Keep every finished card</li>
          </ul>
          <div className="ticket-stamp">NO SUBSCRIPTION</div>
        </aside>
      </section>

      <section className="pricing-includes">
        <div>
          <span className="pixel-label">WHAT YOUR $5 BUYS</span>
          <h2>Five looks in.<br /><em>Up to five keepsakes out.</em></h2>
        </div>
        <ol>
          {included.map((item, index) => (
            <li key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="pricing-plain-terms">
        <div>
          <span>PAYMENT</span>
          <h2>What happens at checkout?</h2>
          <p>
            Paddle securely processes the one-time payment as our Merchant of
            Record. Paddle handles payment details, applicable sales tax or VAT,
            and your receipt. Any tax due is shown before you confirm payment.
          </p>
        </div>
        <div>
          <span>DELIVERY</span>
          <h2>What do I receive?</h2>
          <p>
            Each completed attempt produces a digital 9:16 pet card you can save
            and share. Nothing physical is shipped. Completed cards and their
            optimized photos stay private in your account until you delete them.
          </p>
        </div>
        <div>
          <span>CREDIT USE</span>
          <h2>When is a credit used?</h2>
          <p>
            One credit is used whenever the AI returns an accepted or rejected
            photo response, because both require a full analysis. Invalid files
            use no credit. Provider or worker failures return the reserved credit
            automatically. Purchases also have our{" "}
            <Link href="/refund-policy">14-day full-refund guarantee</Link>.
          </p>
        </div>
      </section>

      <section className="pricing-final">
        <span>FIVE ATTEMPTS. FIVE PETS, FIVE LOOKS, OR FIVE CHANCES AT THE ONE.</span>
        <h2>Make the card that makes everyone say, “that is so them.”</h2>
        <Link href="/#maker">Start with their photo →</Link>
      </section>

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
    </main>
  );
}
