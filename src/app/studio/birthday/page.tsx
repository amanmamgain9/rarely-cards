import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BirthdayStudio } from "@/components/birthday/birthday-studio";
import { requireUser } from "@/lib/auth";
import { getResumableAnalysisById } from "@/lib/analysis/resume-server";
import { hasSeedanceEnv } from "@/lib/env";
import { ensureDevelopmentVideoCredits } from "@/lib/payments/development-credits";
import { getStudioCreditBalance } from "@/lib/studio/videos";
import { DEFAULT_PET_VOICE_ACCENT, petVoiceAccentSchema } from "@/lib/video/accent";

export const metadata: Metadata = {
  title: "Birthday Studio — Rarely",
  description: "Bring several pets together in one talking birthday greeting.",
  robots: { index: false, follow: false },
};

export default async function BirthdayStudioPage({
  searchParams,
}: {
  searchParams: Promise<{
    draft?: string | string[];
    source?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rawSource = Array.isArray(params.source) ? params.source[0] : params.source;
  const source = rawSource && /^[a-z0-9-]{1,64}$/i.test(rawSource)
    ? rawSource
    : null;
  const returnPath = source
    ? `/studio/birthday?source=${encodeURIComponent(source)}`
    : "/studio/birthday";
  const { user } = await requireUser();
  if (!user) redirect(`/?signin=1&next=${encodeURIComponent(returnPath)}`);
  await ensureDevelopmentVideoCredits(user.id);

  const rawDraft = Array.isArray(params.draft) ? params.draft[0] : params.draft;
  const draftId = z.string().uuid().safeParse(rawDraft).data;
  const [creditBalance, draft] = await Promise.all([
    getStudioCreditBalance(user.id),
    draftId
      ? getResumableAnalysisById(user.id, draftId, "birthday_video")
      : Promise.resolve(null),
  ]);
  if (draftId && !draft) redirect("/studio");
  if (creditBalance === 0) {
    redirect(
      draft
        ? `/studio/credits?draft=${draft.id}`
        : `/studio/credits?next=${encodeURIComponent(returnPath)}`,
    );
  }
  return (
    <BirthdayStudio
      creditBalance={creditBalance}
      imageConfigured={Boolean(process.env.GEMINI_API_KEY?.trim())}
      seedanceConfigured={hasSeedanceEnv()}
      initialDraft={
        draft?.photoUrl
          ? {
              id: draft.id,
              photoUrl: draft.photoUrl,
              recipientName: draft.petName ?? "",
              dialogue: draft.selectedDialogue,
              voiceAccent:
                petVoiceAccentSchema.safeParse(draft.draftData.voiceAccent).data ??
                DEFAULT_PET_VOICE_ACCENT,
            }
          : null
      }
    />
  );
}
