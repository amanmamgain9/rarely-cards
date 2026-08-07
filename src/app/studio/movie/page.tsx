import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MovieStudio } from "@/components/movie/movie-studio";
import { requireUser } from "@/lib/auth";
import { getResumableAnalysisById } from "@/lib/analysis/resume-server";
import { hasSeedanceEnv } from "@/lib/env";
import { movieCatalog, movieMoments, movieSceneSchema, movieTitleSchema } from "@/lib/movie/scenes";
import { ensureDevelopmentVideoCredits } from "@/lib/payments/development-credits";
import { getStudioCreditBalance } from "@/lib/studio/videos";

export const metadata: Metadata = {
  title: "Movie Studio — Rarely",
  description: "Put your pet inside a famous movie scene.",
  robots: { index: false, follow: false },
};

export default async function MovieStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string | string[] }>;
}) {
  const { user } = await requireUser();
  if (!user) redirect("/?signin=1&next=/studio/movie");
  await ensureDevelopmentVideoCredits(user.id);
  const params = await searchParams;
  const rawDraft = Array.isArray(params.draft) ? params.draft[0] : params.draft;
  const draftId = z.string().uuid().safeParse(rawDraft).data;
  const [creditBalance, draft] = await Promise.all([
    getStudioCreditBalance(user.id),
    draftId ? getResumableAnalysisById(user.id, draftId, "movie_scene") : Promise.resolve(null),
  ]);
  if (draftId && !draft) redirect("/studio");
  const storedScene = movieSceneSchema.safeParse(draft?.draftData.scene).data;
  const storedMovie = movieTitleSchema.safeParse(draft?.draftData.movie).data;
  const sceneReady = draft?.draftData.sceneReady === true;
  const movie = storedMovie ?? movieCatalog[0].title;
  const scene = storedScene ?? movieMoments(movie)[1]?.scene ?? movieCatalog[0].scenes[0];
  const voiceInstruction = typeof draft?.draftData.voiceInstruction === "string"
    ? draft.draftData.voiceInstruction
    : "";
  const voiceUrl = typeof draft?.draftData.voiceRecordingPath === "string"
    ? `/api/analyses/${draft.id}/voice`
    : null;

  return (
    <MovieStudio
      creditBalance={creditBalance}
      imageConfigured={Boolean(process.env.GEMINI_API_KEY?.trim())}
      seedanceConfigured={hasSeedanceEnv()}
      initialDraft={draft?.photoUrl ? {
        id: draft.id,
        photoUrl: draft.photoUrl,
        sourcePhotoUrl: `/api/analyses/${draft.id}/photo?source=1`,
        dialogue: draft.selectedDialogue,
        movie,
        scene,
        voiceInstruction,
        voiceUrl,
        sceneReady,
      } : null}
    />
  );
}
