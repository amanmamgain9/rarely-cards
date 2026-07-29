import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";

export const metadata: Metadata = {
  title: "Refund Policy — Rarely",
  description: "Rarely's 14-day money-back guarantee for five-card credit packs.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  return (
    <main className="legal-page">
      <PublicHeader />
      <article>
        <span className="pixel-label">EFFECTIVE JULY 23, 2026</span>
        <h1>Fourteen days. Full refund.</h1>
        <p>
          Rarely offers a full refund for any five-card credit pack requested
          within 14 calendar days of purchase. This guarantee applies even if
          some or all card credits were used. No partial refund calculation is
          required.
        </p>

        <h2>How to request it</h2>
        <p>
          Sign in, open your <Link href="/account">account purchase history</Link>,
          and choose “Request full refund” beside an eligible purchase. You may
          also email amanmamgain9@gmail.com from the address used to buy the pack.
          Include the purchase date or receipt details if available.
        </p>

        <h2>What happens to credits</h2>
        <p>
          Unused credits from the purchase are frozen when a refund is requested
          and removed when the payment provider approves it. Cards already
          generated remain in your account unless you delete their saved photos.
        </p>

        <h2>Processing time</h2>
        <p>
          Google Play or Paddle processes the refund to the original payment
          method. Google Play purchases remain store-managed. Approval may be
          required. Refunds typically appear in 3–5 working days after approval,
          though your bank or payment provider may take longer.
        </p>

        <h2>After 14 days</h2>
        <p>
          The published money-back guarantee ends after 14 days. Mandatory
          consumer rights still apply. For a duplicate charge, unauthorized
          payment, or unresolved technical issue, contact amanmamgain9@gmail.com.
        </p>
      </article>
      <PublicFooter />
    </main>
  );
}
