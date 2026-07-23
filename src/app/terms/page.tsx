import { PublicFooter, PublicHeader } from "@/components/public-chrome";

export const metadata = {
  title: "Terms — Rarely",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <PublicHeader />
      <article>
        <span className="pixel-label">EFFECTIVE JULY 23, 2026</span>
        <h1>The deal, without the fine-print theatre.</h1>
        <p>
          Rarely is operated by Aman Mamgain, sole proprietor. Rarely is a
          playful AI entertainment product. Its scores are
          subjective creative output, not scientific measurement, veterinary
          advice, breed certification, professional assessment, or a statement
          of fact about an animal&apos;s personality.
        </p>

        <h2>Your upload</h2>
        <p>
          You must be at least 18 and own the photo or have permission to use
          it. Submit one clearly visible cat or dog and avoid identifiable
          people who have not agreed to appear. Do not upload illegal,
          exploitative, impersonating, or privacy-invasive material. Rarely
          infers cat or dog from the image and uses the pronouns you select; it
          does not infer the pet&apos;s sex, age, health, breed quality, history,
          or relationship with you.
        </p>

        <h2>The $5 five-card pack</h2>
        <p>
          One $5 USD checkout adds five card credits to your Rarely account. It
          is a one-time purchase, not a subscription, and you may buy additional
          packs whenever you want. One credit is used whenever the AI returns a
          valid accepted or rejected response. Invalid files do not use a
          credit. If a provider or worker failure prevents a valid response,
          Rarely returns the reserved credit automatically.
        </p>

        <h2>Refunds</h2>
        <p>
          You may request a full refund within 14 days of a five-card pack
          purchase, even if some or all credits were used. Requests are handled
          under our Refund Policy and processed by Paddle. Paddle may mark live
          refunds as pending approval, and banks may take additional time to
          return funds. Refunded or disputed purchases lose any unused credits.
        </p>

        <h2>Availability and acceptable use</h2>
        <p>
          We may rate-limit abuse, reject unsupported images, pause service, or
          remove unlawful content. Do not reverse engineer safeguards, automate
          bulk image analysis, upload other people&apos;s private photographs
          without permission, or use Rarely for veterinary, breeding, sale,
          insurance, identification, or other consequential decisions.
        </p>

        <h2>Liability</h2>
        <p>
          The service is provided as available. To the extent permitted by law,
          Rarely is not liable for indirect or consequential losses. Our total
          liability for a purchase is limited to the amount paid for that
          purchase. Consumer rights that cannot legally be waived still apply.
          Contact amanmamgain9@gmail.com with legal, billing, or product questions.
        </p>
      </article>
      <PublicFooter />
    </main>
  );
}

