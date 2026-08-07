import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AgentCreate } from "@/components/studio/agent-create";
import { StudioHeader } from "@/components/studio/studio-header";
import { requireUser } from "@/lib/auth";
import { ensureDevelopmentVideoCredits } from "@/lib/payments/development-credits";
import { getStudioCreditBalance } from "@/lib/studio/videos";

export const metadata: Metadata = {
  title: "Create — Rarely",
  description: "Choose what to make with your pet photos.",
  robots: { index: false, follow: false },
};

export default async function CreatePage() {
  const { user } = await requireUser();
  if (!user) redirect("/?signin=1&next=/studio/create");
  await ensureDevelopmentVideoCredits(user.id);
  const creditBalance = await getStudioCreditBalance(user.id);
  return (
    <main className="min-h-svh bg-background text-ink">
      <StudioHeader creditBalance={creditBalance} />
      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[1120px] pb-20 pt-12 max-sm:w-[calc(100%-1.75rem)]">
        <h1 className="mb-8 text-center font-display text-[clamp(2.5rem,7vw,5rem)] font-normal leading-none">
          Make anything.
        </h1>
        <AgentCreate />
      </section>
    </main>
  );
}
