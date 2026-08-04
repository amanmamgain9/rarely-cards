import { LegalArticle, LegalEyebrow, LegalHeading, LegalShell, LegalTitle } from "@/components/legal-shell";

export const metadata = {
  title: "Privacy — Rarely",
  description: "How Rarely handles pet photos, talking-pet videos, account data, payments, and website analytics.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalShell>
      <LegalArticle>
        <LegalEyebrow>EFFECTIVE AUGUST 4, 2026</LegalEyebrow>
        <LegalTitle>Privacy, without the fog.</LegalTitle>
        <p>
          Rarely turns one photograph of a cat or dog and a short line you
          choose into an entertainment-only talking-pet video. We do not use the photo for
          identity verification, biometric identification, veterinary or
          medical analysis, breed certification, or model training.
        </p>

        <LegalHeading>What we handle</LegalHeading>
        <p>
          We process your account identifier, email, the pet name and pronouns
          and line you provide, our suggested lines, payment status, generation
          status, provider token usage, and the creative analysis used to make the video.
          Google Play or Paddle handles payment details; Rarely does not store
          full payment card data.
        </p>

        <LegalHeading>Photo handling</LegalHeading>
        <p>
          Before sign-in, the selected photo may be stored in this browser for
          up to 24 hours. After sign-in it is uploaded to a private Supabase
          Storage bucket, sent to Google Gemini to read the visible pet and
          scene, and retained privately in your account. Valid uploaded photos
          remain until you delete them or request
          account deletion. Files that are malformed or cannot be stored safely
          may be discarded.
        </p>

        <LegalHeading>Talking-pet videos</LegalHeading>
        <p>
          When you choose “Make my pet talk,” Rarely sends the saved pet photo,
          selected pet details, and your chosen line to BytePlus ModelArk
          so its Seedance model can generate a short video. Rarely also sends a
          one-way account identifier used for provider safety controls. BytePlus
          temporarily hosts the generation task and output; Rarely copies a
          successful video into your private Supabase storage promptly. We do
          not send payment details, your email address, or your plain account ID
          to BytePlus. This transfer happens only after you choose the video action.
          Saved pet videos remain in your account until you delete the source
          photo, request their deletion, or request account deletion.
        </p>

        <LegalHeading>Sharing and retention</LegalHeading>
        <p>
          Supabase provides authentication, database, and private storage;
          Google processes the image to suggest dialogue and describe the visible scene; BytePlus processes the
          image and chosen line only when you request a talking-pet video;
          Google Play or Paddle
          processes checkout and refunds; Vercel hosts the app; and Sentry may
          receive redacted technical errors. We retain creative analysis results
          and transaction state for account access, support, fraud prevention,
          and legal obligations. Saved photos remain until you delete the
          photo or request account deletion. Error logs never intentionally
          include photos, auth tokens, payment secrets, or full model prompts
          and responses.
        </p>

        <LegalHeading>Your choices</LegalHeading>
        <p>
          Upload only a photo you own or are allowed to use. Avoid photographs
          containing identifiable people who have not agreed to appear. You may
          clear browser storage at any time and may request deletion of your
          saved photo from your account and may request deletion of your account
          and retained results at amanmamgain9@gmail.com. Some transaction records
          must be retained where law requires.
        </p>

        <LegalHeading>Website analytics</LegalHeading>
        <p>
          Google Analytics helps Rarely understand aggregate site
          traffic, page use, and conversion steps. Google may receive device,
          browser, approximate location, referral, and interaction data and may
          use cookies or similar identifiers. Rarely does not intentionally send
          pet names, email addresses, uploaded photos, generated lines, videos,
          payment details, or other creative content to analytics. You can limit
          this processing with browser privacy controls or Google&apos;s analytics
          opt-out tools.
        </p>

        <LegalHeading>Age and changes</LegalHeading>
        <p>
          Rarely is for adults aged 18 or older. Material policy changes will
          be posted here with a new effective date. Contact
          amanmamgain9@gmail.com with privacy requests or questions.
        </p>
      </LegalArticle>
    </LegalShell>
  );
}
