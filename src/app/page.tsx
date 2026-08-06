import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicRarityHome } from "@/components/rarity/public-rarity-home";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Talking Pet & Birthday Video Maker — Rarely",
  description:
    "Make AI talking-pet and personalized pet birthday videos from your photos. Download short MP4 videos with sound.",
  alternates: { canonical: "/" },
};

type HomeProps = {
  searchParams: Promise<{
    signin?: string | string[];
    auth_error?: string | string[];
    next?: string | string[];
  }>;
};

function safeNextPath(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/studio";
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const supabaseConfigured = hasPublicSupabaseEnv();
  const returnTo = safeNextPath(params.next);

  if (supabaseConfigured) {
    const { user } = await requireUser();
    if (user) redirect(returnTo);
  }

  const videoJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "AI talking pet video example",
    description: "A smiling corgi talks in an eight-second Rarely video made from one pet photo.",
    thumbnailUrl: `${SITE_URL}/examples/talking-corgi-poster.jpg`,
    uploadDate: "2026-08-06T00:00:00.000Z",
    duration: "PT8S",
    contentUrl: `${SITE_URL}/examples/talking-corgi.mp4`,
    embedUrl: SITE_URL,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(videoJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <PublicRarityHome
        supabaseConfigured={supabaseConfigured}
        returnTo={returnTo}
        openSignIn={
          params.signin === "1" ||
          (Array.isArray(params.signin) && params.signin.includes("1"))
        }
        authError={
          params.auth_error === "missing_code"
            ? "That sign-in link is incomplete. Request a new one."
            : params.auth_error === "callback_failed"
              ? "That sign-in could not be completed. Try again."
              : null
        }
      />
    </>
  );
}
