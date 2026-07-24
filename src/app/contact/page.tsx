import type { Metadata } from "next";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";

export const metadata: Metadata = {
  title: "Contact — Rarely",
  description: "Contact Rarely for product, billing, refund, or privacy support.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main className="legal-page contact-page">
      <PublicHeader />
      <article>
        <span className="pixel-label">A REAL INBOX · A REAL PERSON</span>
        <h1>Tell us what happened.</h1>
        <p>
          For card generation, account, billing, refund, legal, or privacy help,
          email us. Include the email on your Rarely account and the approximate
          purchase or attempt date so we can find the right record.
        </p>

        <a className="contact-email" href="mailto:amanmamgain9@gmail.com">
          amanmamgain9@gmail.com <span>→</span>
        </a>

        <h2>Operator</h2>
        <p>
          Rarely is operated by Aman Mamgain, sole proprietor. Payments are
          securely processed by Lemon Squeezy or Paddle as Merchant of Record.
        </p>

        <h2>Buyer payment support</h2>
        <p>
          Use the support link in your Lemon Squeezy or Paddle receipt for
          provider-specific payment help. If your statement shows a charge from
          Paddle, you can also use Paddle&apos;s buyer support at{" "}
          <a href="https://paddle.net" rel="noreferrer" target="_blank">
            paddle.net
          </a>
          .
        </p>
      </article>
      <PublicFooter />
    </main>
  );
}
