import { cookies } from "next/headers";
import { RarityApp } from "@/components/rarity-app";
import { PENDING_PHOTO_COOKIE } from "@/lib/analysis/resume";
import { getLatestResumableAnalysis } from "@/lib/analysis/resume-server";
import type { PublicAnalysis } from "@/lib/analysis/types";
import {
  hasLemonSqueezyEnv,
  hasPaddleEnv,
  hasPublicSupabaseEnv,
} from "@/lib/env";
import { isZazzlePrintEnabled } from "@/lib/printing/zazzle";
import { createClient } from "@/lib/supabase/server";

type HomeProps = {
  searchParams: Promise<{ resume?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const supabaseConfigured = hasPublicSupabaseEnv();
  let user: { id: string; email: string | null } | null = null;
  let creditBalance = 0;
  let initialAnalysis: PublicAnalysis | null = null;

  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (currentUser) {
      user = { id: currentUser.id, email: currentUser.email ?? null };
      const [{ data: purchases }, resumableAnalysis] = await Promise.all([
        supabase
          .from("credit_purchases")
          .select("credits_remaining")
          .eq("status", "active"),
        getLatestResumableAnalysis(currentUser.id),
      ]);
      creditBalance = (purchases ?? []).reduce(
        (sum, purchase) => sum + purchase.credits_remaining,
        0,
      );
      initialAnalysis = resumableAnalysis;
    }
  }

  const resumeRequested =
    params.resume === "1" ||
    (Array.isArray(params.resume) && params.resume.includes("1"));
  const shouldRestorePendingPhoto = Boolean(
    user &&
      !initialAnalysis &&
      (resumeRequested ||
        cookieStore.get(PENDING_PHOTO_COOKIE)?.value === "1"),
  );

  return (
    <RarityApp
      initialUser={user}
      initialCreditBalance={creditBalance}
      initialAnalysis={initialAnalysis}
      shouldRestorePendingPhoto={shouldRestorePendingPhoto}
      supabaseConfigured={supabaseConfigured}
      lemonSqueezyConfigured={hasLemonSqueezyEnv()}
      paddleConfigured={hasPaddleEnv()}
      zazzlePrintEnabled={isZazzlePrintEnabled()}
      paddleEnvironment={
        process.env.PADDLE_ENVIRONMENT === "production"
          ? "production"
          : "sandbox"
      }
    />
  );
}
