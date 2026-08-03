import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { GenerationWorkspace } from "@/components/studio/generation-workspace";
import { RarelyWorkflowProvider } from "@/components/rarity/rarely-workflow-provider";
import { PENDING_PHOTO_COOKIE } from "@/lib/analysis/resume";
import { getResumableAnalysisById } from "@/lib/analysis/resume-server";
import {
  hasPublicSupabaseEnv,
  hasSeedanceEnv,
} from "@/lib/env";
import { requireUser } from "@/lib/auth";
import {
  developmentVideoCreditBalance,
  ensureDevelopmentVideoCredits,
} from "@/lib/payments/development-credits";

type GeneratePageProps = {
  searchParams: Promise<{
    resume?: string | string[];
    draft?: string | string[];
  }>;
};

export default async function GeneratePage({ searchParams }: GeneratePageProps) {
  if (!hasPublicSupabaseEnv()) redirect("/?signin=1");

  const [params, cookieStore, auth] = await Promise.all([
    searchParams,
    cookies(),
    requireUser(),
  ]);
  if (!auth.user) redirect("/?signin=1");
  await ensureDevelopmentVideoCredits(auth.user.id);

  const draftParam = Array.isArray(params.draft) ? params.draft[0] : params.draft;
  const draftId = z.string().uuid().safeParse(draftParam).data;
  const [{ data: purchases }, initialAnalysis] = await Promise.all([
    auth.supabase
      .from("credit_purchases")
      .select("credits_remaining, credit_kind")
      .eq("status", "active"),
    draftId
      ? getResumableAnalysisById(auth.user.id, draftId)
      : Promise.resolve(null),
  ]);
  if (draftId && !initialAnalysis) redirect("/studio");
  const creditBalance = developmentVideoCreditBalance(
    (purchases ?? []).reduce(
      (sum, purchase) =>
        sum +
        (purchase.credit_kind === "talking_video"
          ? purchase.credits_remaining
          : 0),
      0,
    ),
  );
  if (initialAnalysis && creditBalance === 0) {
    redirect(`/studio/credits?draft=${initialAnalysis.id}`);
  }
  const resumeRequested =
    params.resume === "1" ||
    (Array.isArray(params.resume) && params.resume.includes("1"));
  const shouldRestorePendingPhoto = Boolean(
    !initialAnalysis &&
      (resumeRequested || cookieStore.get(PENDING_PHOTO_COOKIE)?.value === "1"),
  );

  return (
    <RarelyWorkflowProvider
      userId={auth.user.id}
      initialSnapshot={{
        creditBalance,
        analysis: initialAnalysis,
      }}
    >
      <GenerationWorkspace
        initialAnalysis={initialAnalysis}
        shouldRestorePendingPhoto={shouldRestorePendingPhoto}
        seedanceConfigured={hasSeedanceEnv()}
      />
    </RarelyWorkflowProvider>
  );
}
