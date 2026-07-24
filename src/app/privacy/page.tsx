import { PublicFooter, PublicHeader } from "@/components/public-chrome";

export const metadata = {
  title: "Privacy — Rarely",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <PublicHeader />
      <article>
        <span className="pixel-label">EFFECTIVE JULY 23, 2026</span>
        <h1>Privacy, without the fog.</h1>
        <p>
          Rarely turns one photograph of a cat or dog into an
          entertainment-only collectible card. We do not use the photo for
          identity verification, biometric identification, veterinary or
          medical analysis, breed certification, or model training.
        </p>

        <h2>What we handle</h2>
        <p>
          We process your account identifier, email, the pet name and pronouns
          you provide, payment status, analysis status, and the result shown on the card.
          Google Play, Lemon Squeezy, or Paddle handles payment details; Rarely
          does not store full payment card data.
        </p>

        <h2>Photo handling</h2>
        <p>
          Before sign-in, the selected photo may be stored in this browser for
          up to 24 hours. After sign-in it is uploaded to a private Supabase
          Storage bucket, sent to Google Gemini to read the visible pet and
          scene, and retained privately in your account. Completed cards may
          also have an optimized copy for faster reopening, downloading, and
          sharing. Valid uploaded photos remain until you delete them or request
          account deletion. Files that are malformed or cannot be stored safely
          may be discarded.
        </p>

        <h2>Sharing and retention</h2>
        <p>
          Supabase provides authentication, database, and private storage;
          Google processes the image for AI output; Google Play, Lemon Squeezy,
          or Paddle processes checkout and refunds; Vercel hosts the app; and
          Sentry may receive redacted technical errors. We retain card results
          and transaction state for account access, support, fraud prevention,
          and legal obligations. Saved card photos remain until you delete the
          photo or request account deletion. Error logs never intentionally
          include photos, auth tokens, payment secrets, or full model prompts
          and responses.
        </p>

        <h2>Your choices</h2>
        <p>
          Upload only a photo you own or are allowed to use. Avoid photographs
          containing identifiable people who have not agreed to appear. You may
          clear browser storage at any time and may request deletion of your
          saved photo from your account and may request deletion of your account
          and retained results at amanmamgain9@gmail.com. Some transaction records
          must be retained where law requires.
        </p>

        <h2>Age and changes</h2>
        <p>
          Rarely is for adults aged 18 or older. Material policy changes will
          be posted here with a new effective date. Contact
          amanmamgain9@gmail.com with privacy requests or questions.
        </p>
      </article>
      <PublicFooter />
    </main>
  );
}

