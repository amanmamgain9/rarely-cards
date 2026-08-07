import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreationCards } from "@/components/creation-cards";
import { StudioHeader } from "@/components/studio-header";
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
  if (creditBalance === 0) redirect("/studio/credits?next=%2Fstudio%2Fcreate");

  return (
    <main className="min-h-svh bg-background text-ink">
      <StudioHeader creditBalance={creditBalance} />
      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[1120px] pb-20 pt-12 max-sm:w-[calc(100%-1.75rem)]">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-pink">Create</p>
        <h1 className="mb-8 mt-3 font-display text-[clamp(2.5rem,7vw,5rem)] font-normal leading-none">
          What should your pet make?
        </h1>
        <CreationCards />
      </section>
    </main>
  );
}
