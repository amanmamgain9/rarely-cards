import { LegalArticle, LegalEyebrow, LegalHeading, LegalShell, LegalTitle } from "@/components/legal-shell";

export const metadata = {
  title: "Terms — Rarely",
};

export default function TermsPage() {
  return (
    <LegalShell>
      <LegalArticle>
        <LegalEyebrow>EFFECTIVE JULY 30, 2026</LegalEyebrow>
        <LegalTitle>The deal, without the fine-print theatre.</LegalTitle>
        <p>
          Rarely is operated by Aman Mamgain, sole proprietor. Rarely is a
          playful AI entertainment product. Its scores are
          subjective creative output, not scientific measurement, veterinary
          advice, breed certification, professional assessment, or a statement
          of fact about an animal&apos;s personality.
        </p>

        <LegalHeading>AI talking-pet videos</LegalHeading>
        <p>
          Each video credit includes one Seedance generation. Choosing “Make my pet talk” authorizes Rarely to send the
          pet photo and chosen line to BytePlus Seedance for generation. AI video
          can alter motion, speech, or visible details and is
          entertainment output, not a faithful record of an event. Availability,
          duration, and provider may change as the service develops.
        </p>

        <LegalHeading>Your upload</LegalHeading>
        <p>
          You must be at least 18 and own the photo or have permission to use
          it. Submit one clearly visible cat or dog and avoid identifiable
          people who have not agreed to appear. Do not upload illegal,
          exploitative, impersonating, or privacy-invasive material. Rarely
          infers cat or dog from the image and uses the pronouns you select; it
          does not infer the pet&apos;s sex, age, health, breed quality, history,
          or relationship with you.
        </p>

        <LegalHeading>The three-video pack</LegalHeading>
        <p>
          One checkout adds three talking-pet video credits to your Rarely account. The web
          price is $10 USD; Google Play shows the Android price in your local
          currency before purchase. It is a one-time purchase, not a
          subscription, and you may buy additional packs whenever you want. One
          credit is reserved when you choose “Make my pet talk” and used by a
          completed video. Invalid files, rejected photos, and provider or worker
          failures return the reserved credit automatically. A credit buys one
          generation attempt; it does not include unlimited rerolls.
        </p>
        <p>
          Historical card purchases remain recorded with their original refund
          treatment. They are not converted into video credits without the
          customer&apos;s agreement.
        </p>

        <LegalHeading>Refunds</LegalHeading>
        <p>
          You may request a full refund within 14 days of a three-video pack
          purchase, even if some or all credits were used. Requests are handled
          under our Refund Policy and processed by the provider used at
          checkout—Google Play or Paddle. A provider may mark a refund as
          pending approval, and banks may take additional time to return funds.
          Refunded or disputed purchases lose any unused credits.
        </p>

        <LegalHeading>Availability and acceptable use</LegalHeading>
        <p>
          We may rate-limit abuse, reject unsupported images, pause service, or
          remove unlawful content. Do not reverse engineer safeguards, automate
          bulk image analysis, upload other people&apos;s private photographs
          without permission, or use Rarely for veterinary, breeding, sale,
          insurance, identification, or other consequential decisions.
        </p>

        <LegalHeading>Liability</LegalHeading>
        <p>
          The service is provided as available. To the extent permitted by law,
          Rarely is not liable for indirect or consequential losses. Our total
          liability for a purchase is limited to the amount paid for that
          purchase. Consumer rights that cannot legally be waived still apply.
          Contact amanmamgain9@gmail.com with legal, billing, or product questions.
        </p>
      </LegalArticle>
    </LegalShell>
  );
}
