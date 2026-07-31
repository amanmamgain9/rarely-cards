import type { Metadata } from "next";
import { LegalArticle, LegalEyebrow, LegalHeading, LegalShell, LegalTitle } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Contact — Rarely",
  description: "Contact Rarely for product, billing, refund, or privacy support.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <LegalShell>
      <LegalArticle>
        <LegalEyebrow>A REAL INBOX · A REAL PERSON</LegalEyebrow>
        <LegalTitle>Tell us what happened.</LegalTitle>
        <p>
          For card generation, account, billing, refund, legal, or privacy help,
          email us. Include the email on your Rarely account and the approximate
          purchase or attempt date so we can find the right record.
        </p>

        <a className="my-8 flex items-center justify-between rounded-2xl border-[3px] border-ink bg-yellow px-5 py-4 font-mono text-[clamp(0.875rem,3vw,1.2rem)] font-bold text-ink shadow-[5px_5px_0_#241a44]" href="mailto:amanmamgain9@gmail.com">
          amanmamgain9@gmail.com <span>→</span>
        </a>

        <LegalHeading>Operator</LegalHeading>
        <p>
          Rarely is operated by Aman Mamgain, sole proprietor. Payments are
          securely processed by Paddle as Merchant of Record on the web and by
          Google Play in the Android app.
        </p>

        <LegalHeading>Buyer payment support</LegalHeading>
        <p>
          Use the support link in your Paddle or Google Play receipt for
          provider-specific payment help. For Paddle purchases, you can also use
          Paddle&apos;s buyer support at{" "}
          <a className="font-black text-pink underline decoration-2 underline-offset-4" href="https://paddle.net" rel="noreferrer" target="_blank">
            paddle.net
          </a>
          .
        </p>
      </LegalArticle>
    </LegalShell>
  );
}
