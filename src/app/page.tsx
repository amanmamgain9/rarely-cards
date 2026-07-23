import { RarityApp } from "@/components/rarity-app";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabaseConfigured = hasPublicSupabaseEnv();
  let user: { id: string; email: string | null } | null = null;
  let creditBalance = 0;

  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (currentUser) {
      user = { id: currentUser.id, email: currentUser.email ?? null };
      const { data: purchases } = await supabase
        .from("credit_purchases")
        .select("credits_remaining")
        .eq("status", "active");
      creditBalance = (purchases ?? []).reduce(
        (sum, purchase) => sum + purchase.credits_remaining,
        0,
      );
    }
  }

  return (
    <RarityApp
      initialUser={user}
      initialCreditBalance={creditBalance}
      supabaseConfigured={supabaseConfigured}
      paddleConfigured={Boolean(
        process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      )}
      paddleEnvironment={
        process.env.PADDLE_ENVIRONMENT === "production"
          ? "production"
          : "sandbox"
      }
    />
  );
}
