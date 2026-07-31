import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RarityApp } from "@/components/rarity-app";
import { RarelyWorkflowProvider } from "@/components/rarity/rarely-workflow-provider";
import { PENDING_PHOTO_COOKIE } from "@/lib/analysis/resume";
import { getLatestResumableAnalysis } from "@/lib/analysis/resume-server";
import {
  hasGooglePlayEnv,
  hasPaddleEnv,
  hasPublicSupabaseEnv,
  hasSeedanceEnv,
} from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { isZazzlePrintEnabled } from "@/lib/printing/zazzle";

type AppPageProps = {
  searchParams: Promise<{
    resume?: string | string[];
    legacy?: string | string[];
  }>;
};

export default async function AppPage({ searchParams }: AppPageProps) {
  if (!hasPublicSupabaseEnv()) redirect("/?signin=1");

  const [params, cookieStore, auth] = await Promise.all([
    searchParams,
    cookies(),
    requireUser(),
  ]);
  if (!auth.user) redirect("/?signin=1");

  const legacyRequested =
    params.legacy === "card" ||
    (Array.isArray(params.legacy) && params.legacy.includes("card"));
  const [{ data: purchases }, initialAnalysis] = await Promise.all([
    auth.supabase
      .from("credit_purchases")
      .select("credits_remaining, credit_kind")
      .eq("status", "active"),
    getLatestResumableAnalysis(
      auth.user.id,
      legacyRequested ? "card" : "talking_video",
    ),
  ]);
  const creditBalance = (purchases ?? []).reduce(
    (sum, purchase) =>
      sum +
      (purchase.credit_kind === "talking_video"
        ? purchase.credits_remaining
        : 0),
    0,
  );
  const legacyCardCreditBalance = (purchases ?? []).reduce(
    (sum, purchase) =>
      sum +
      (purchase.credit_kind === "card" ? purchase.credits_remaining : 0),
    0,
  );
  const resumeRequested =
    params.resume === "1" ||
    (Array.isArray(params.resume) && params.resume.includes("1"));
  const shouldRestorePendingPhoto = Boolean(
    !initialAnalysis &&
      (resumeRequested ||
        cookieStore.get(PENDING_PHOTO_COOKIE)?.value === "1"),
  );

  return (
    <RarelyWorkflowProvider
      userId={auth.user.id}
      initialSnapshot={{
        creditBalance,
        legacyCardCreditBalance,
        analysis: initialAnalysis,
      }}
    >
      <RarityApp
        initialUser={auth.user}
        legacyCardMode={
          initialAnalysis
            ? initialAnalysis.experienceKind === "card"
            : legacyRequested
        }
        initialAnalysis={initialAnalysis}
        shouldRestorePendingPhoto={shouldRestorePendingPhoto}
        paddleConfigured={hasPaddleEnv()}
        googlePlayConfigured={hasGooglePlayEnv()}
        seedanceConfigured={hasSeedanceEnv()}
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
