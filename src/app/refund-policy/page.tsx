import type { Metadata } from "next";
import Link from "next/link";
import { LegalArticle, LegalEyebrow, LegalHeading, LegalShell, LegalTitle } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Refund Policy — Rarely",
  description: "Rarely's 14-day money-back guarantee for talking-pet video packs.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  return (
    <LegalShell>
      <LegalArticle>
        <LegalEyebrow>EFFECTIVE JULY 23, 2026</LegalEyebrow>
        <LegalTitle>Fourteen days. Full refund.</LegalTitle>
        <p>
          Rarely offers a full refund for any current three-video pack or
          historical five-card pack requested
          within 14 calendar days of purchase. This guarantee applies even if
          some or all included credits were used. No partial refund calculation is
          required.
        </p>

        <LegalHeading>How to request it</LegalHeading>
        <p>
          Sign in, open your <Link className="font-black text-pink underline decoration-2 underline-offset-4" href="/account">account purchase history</Link>,
          and choose “Request full refund” beside an eligible purchase. You may
          also email amanmamgain9@gmail.com from the address used to buy the pack.
          Include the purchase date or receipt details if available.
        </p>

        <LegalHeading>What happens to credits</LegalHeading>
        <p>
          Unused credits from the purchase are frozen when a refund is requested
          and removed when the payment provider approves it. Generated videos
          remain in your account unless you delete them.
        </p>

        <LegalHeading>Processing time</LegalHeading>
        <p>
          Google Play or Paddle processes the refund to the original payment
          method. Google Play purchases remain store-managed. Approval may be
          required. Refunds typically appear in 3–5 working days after approval,
          though your bank or payment provider may take longer.
        </p>

        <LegalHeading>After 14 days</LegalHeading>
        <p>
          The published money-back guarantee ends after 14 days. Mandatory
          consumer rights still apply. For a duplicate charge, unauthorized
          payment, or unresolved technical issue, contact amanmamgain9@gmail.com.
        </p>
      </LegalArticle>
    </LegalShell>
  );
}
