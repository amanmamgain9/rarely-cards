import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicRarityHome } from "@/components/rarity/public-rarity-home";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "AI Talking Pet Video Generator — Rarely",
  description:
    "Turn one cat or dog photo and one perfect line into an eight-second AI talking-pet video with sound.",
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

  return (
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
  );
}
