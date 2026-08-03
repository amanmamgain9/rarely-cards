import { redirect } from "next/navigation";
import { PublicRarityHome } from "@/components/rarity/public-rarity-home";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth";

type HomeProps = {
  searchParams: Promise<{
    signin?: string | string[];
    auth_error?: string | string[];
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const supabaseConfigured = hasPublicSupabaseEnv();

  if (supabaseConfigured) {
    const { user } = await requireUser();
    if (user) redirect("/studio");
  }

  return (
    <PublicRarityHome
      supabaseConfigured={supabaseConfigured}
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
