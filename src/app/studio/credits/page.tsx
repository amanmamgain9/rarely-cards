import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CreditCheckout } from "@/components/payments/credit-checkout";
import { StudioHeader } from "@/components/studio-header";
import { requireUser } from "@/lib/auth";
import { getResumableAnalysisById } from "@/lib/analysis/resume-server";
import { isDraftAnalysisStatus } from "@/lib/analysis/resume";
import { hasGooglePlayEnv, hasPaddleEnv, hasSeedanceEnv } from "@/lib/env";
import { getStudioCreditBalance } from "@/lib/studio/videos";

export const metadata: Metadata = {
  title: "Video credits — Rarely",
  description: "Add talking-pet video credits.",
  robots: { index: false, follow: false },
};

export default async function StudioCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string | string[] }>;
}) {
  const { user } = await requireUser();
  if (!user) redirect("/?signin=1");

  const params = await searchParams;
  const draftParam = Array.isArray(params.draft) ? params.draft[0] : params.draft;
  const draftId = z.string().uuid().safeParse(draftParam).data;
  const creditBalance = await getStudioCreditBalance(user.id);
  const draft = draftId
    ? await getResumableAnalysisById(user.id, draftId)
    : null;
  if (draftId && (!draft || !isDraftAnalysisStatus(draft.status))) {
    redirect("/studio");
  }
  if (draft && creditBalance > 0) {
    redirect(`/studio/generate?draft=${draft.id}`);
  }

  return (
    <main className="min-h-svh bg-background text-ink">
      <StudioHeader creditBalance={creditBalance} />
      <section className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[980px] items-center gap-12 pb-20 pt-12 lg:grid-cols-[minmax(0,1fr)_390px] max-sm:w-[calc(100%-1.75rem)] max-sm:pb-12 max-sm:pt-8">
        <div>
          <span className="inline-flex -rotate-1 rounded-md border-2 border-ink bg-yellow px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider shadow-[3px_3px_0_#241a44]">
            Three-video ticket
          </span>
          <h1 className="mt-7 font-display text-[clamp(3rem,8vw,5.75rem)] font-normal leading-[0.9] tracking-[-0.045em]">
            Ready when
            <br />
            <em className="not-italic text-pink">the line is.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-bold leading-relaxed text-ink-muted">
            One payment adds three video credits. One credit is used only when
            you confirm a generation. There is no subscription.
          </p>
          <Link className="mt-6 inline-flex min-h-10 items-center text-sm font-black text-ink-muted underline decoration-2 underline-offset-4 hover:text-pink" href={draft ? "/studio" : "/account"}>
            {draft ? "Keep this as a draft" : "View billing history"}
          </Link>
        </div>

        <aside className="rotate-1 border-4 border-ink bg-yellow p-5 shadow-[10px_11px_0_#241a44,18px_19px_0_#f4458f]">
          <div className="flex justify-between gap-3 border-b-2 border-dashed border-ink pb-4 font-mono text-[8px] font-bold uppercase">
            <span>RLY / VIDEO THREE-PACK</span>
            <span>One-time</span>
          </div>
          {draft?.photoUrl && (
            <div className="relative mx-auto my-5 aspect-[4/3] w-full overflow-hidden border-2 border-ink bg-purple">
              <Image
                alt="The pet photo waiting in your draft"
                className="object-cover"
                fill
                sizes="360px"
                src={draft.photoUrl}
                unoptimized
              />
            </div>
          )}
          <div className="border-y-2 border-dashed border-ink py-5">
            <div>
              <strong className="block font-display text-4xl font-normal">3 credits</strong>
              <span className="font-mono text-[9px] font-bold uppercase">3 talking-pet videos</span>
            </div>
          </div>
          <div className="mt-5">
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
              redirectTo={draft ? `/studio/generate?draft=${draft.id}` : "/studio"}
            />
          </div>
        </aside>
      </section>
    </main>
  );
}
