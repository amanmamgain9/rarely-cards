import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CreditCheckout } from "@/components/payments/credit-checkout";
import { StudioHeader } from "@/components/studio/studio-header";
import { requireUser } from "@/lib/auth";
import { getResumableAnalysisById } from "@/lib/analysis/resume-server";
import { isDraftAnalysisStatus } from "@/lib/analysis/resume";
import { hasGooglePlayEnv, hasPaddleEnv, hasSeedanceEnv } from "@/lib/env";
import { getStudioCreditBalance } from "@/lib/studio/videos";
import { studioPath } from "@/lib/experiences";

export const metadata: Metadata = {
  title: "Video credits — Rarely",
  description: "Add Rarely video credits.",
  robots: { index: false, follow: false },
};

export default async function StudioCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{
    draft?: string | string[];
    next?: string | string[];
  }>;
}) {
  const { user } = await requireUser();
  if (!user) redirect("/?signin=1");

  const params = await searchParams;
  const draftParam = Array.isArray(params.draft) ? params.draft[0] : params.draft;
  const draftId = z.string().uuid().safeParse(draftParam).data;
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;
  const requestedNext =
    nextParam === "/studio" || nextParam?.startsWith("/studio/")
      ? nextParam
      : null;
  const creditBalance = await getStudioCreditBalance(user.id);
  const draft = draftId
    ? await getResumableAnalysisById(user.id, draftId)
    : null;
  if (draftId && (!draft || !isDraftAnalysisStatus(draft.status))) {
    redirect("/studio");
  }
  if (draft && creditBalance > 0) {
    if (draft.experienceKind !== "card") redirect(studioPath(draft.experienceKind, draft.id));
  }
  if (!draft && requestedNext && creditBalance > 0) redirect(requestedNext);
  const draftReturnTo = draft && draft.experienceKind !== "card"
    ? studioPath(draft.experienceKind, draft.id)
    : requestedNext ?? "/studio/create";

  return (
    <main className="min-h-svh bg-background text-ink">
      <StudioHeader creditBalance={creditBalance} />
      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[760px] pb-20 pt-12 max-sm:w-[calc(100%-1.75rem)] max-sm:pb-12 max-sm:pt-8">
        <h1 className="mb-8 font-display text-[clamp(2.5rem,7vw,4.5rem)] font-normal leading-none tracking-[-0.035em]">Get 3 videos</h1>
        <div className={`grid overflow-hidden rounded-3xl border-[3px] border-ink bg-yellow shadow-[7px_8px_0_#241a44] ${draft?.photoUrl ? "md:grid-cols-[1fr_1fr]" : "mx-auto max-w-sm"}`}>
          {draft?.photoUrl && (
            <div className="relative min-h-72 border-b-[3px] border-ink bg-purple md:border-b-0 md:border-r-[3px]">
              <Image
                alt="The selected pet photo"
                className="object-cover"
                fill
                sizes="(max-width: 768px) 100vw, 380px"
                src={draft.photoUrl}
                unoptimized
              />
            </div>
          )}
          <div className="flex flex-col justify-center p-6">
            <CreditCheckout
              analysisId={draft?.id}
              currentBalance={creditBalance}
              googlePlayConfigured={hasGooglePlayEnv()}
              paddleConfigured={hasPaddleEnv()}
              seedanceConfigured={hasSeedanceEnv()}
              paddleEnvironment={
                process.env.PADDLE_ENVIRONMENT === "production"
                  ? "production"
                  : "sandbox"
              }
              redirectTo={draftReturnTo}
            />
            {draft && (
              <Link className="mt-4 min-h-9 text-center text-xs font-black text-ink-muted underline decoration-2 underline-offset-4 hover:text-pink" href="/studio">
                Save for later
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
