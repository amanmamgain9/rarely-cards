import { cookies } from "next/headers";
import { RarityApp } from "@/components/rarity-app";
import { RarelyWorkflowProvider } from "@/components/rarity/rarely-workflow-provider";
import { PENDING_PHOTO_COOKIE } from "@/lib/analysis/resume";
import { getLatestResumableAnalysis } from "@/lib/analysis/resume-server";
import type { PublicAnalysis } from "@/lib/analysis/types";
import {
  hasGooglePlayEnv,
  hasPaddleEnv,
  hasPublicSupabaseEnv,
} from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { isZazzlePrintEnabled } from "@/lib/printing/zazzle";

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
    const { user: currentUser, supabase } = await requireUser();
    if (currentUser) {
      user = currentUser;
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
    <RarelyWorkflowProvider
      userId={user?.id ?? null}
      initialSnapshot={{ creditBalance, analysis: initialAnalysis }}
    >
      <RarityApp
        initialUser={user}
        initialCreditBalance={creditBalance}
        initialAnalysis={initialAnalysis}
        shouldRestorePendingPhoto={shouldRestorePendingPhoto}
        supabaseConfigured={supabaseConfigured}
        paddleConfigured={hasPaddleEnv()}
        googlePlayConfigured={hasGooglePlayEnv()}
        zazzlePrintEnabled={isZazzlePrintEnabled()}
        paddleEnvironment={
          process.env.PADDLE_ENVIRONMENT === "production"
            ? "production"
            : "sandbox"
        }
      />
    </RarelyWorkflowProvider>
  );
}
