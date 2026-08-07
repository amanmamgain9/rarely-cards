import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { StudioHeader } from "@/components/studio/studio-header";
import { StudioVideoActions } from "@/components/studio/studio-video-actions";
import { StudioVideoFeedback } from "@/components/studio/studio-video-feedback";
import { StudioVideoPending } from "@/components/studio/studio-video-pending";
import { StudioVideoRetry } from "@/components/studio/studio-video-retry";
import { requireUser } from "@/lib/auth";
import { ensureDevelopmentVideoCredits } from "@/lib/payments/development-credits";
import { getStudioCreditBalance, getStudioVideo } from "@/lib/studio/videos";

export const metadata: Metadata = {
  title: "Video — Rarely",
  robots: { index: false, follow: false },
};

const videoIdSchema = z.string().uuid();

export default async function StudioVideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { user } = await requireUser();
  if (!user) redirect("/?signin=1");
  const { videoId } = await params;
  if (!videoIdSchema.safeParse(videoId).success) notFound();
  await ensureDevelopmentVideoCredits(user.id);

  const [video, creditBalance] = await Promise.all([
    getStudioVideo(user.id, videoId),
    getStudioCreditBalance(user.id),
  ]);
  if (!video) notFound();

  const ready = video.status === "succeeded" && video.videoUrl;
  const failed = video.status === "failed";

  return (
    <main className="min-h-svh bg-background text-ink">
      <StudioHeader creditBalance={creditBalance} />
      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[1120px] pb-20 pt-8 max-sm:w-[calc(100%-1.75rem)] max-sm:pb-12 max-sm:pt-6">
        <Link aria-label="Back to videos" className="inline-flex min-h-10 items-center gap-2 text-sm font-black text-ink-muted hover:text-pink" href="/studio">
          <span aria-hidden="true">←</span> Videos
        </Link>

        <div className="mt-6 grid items-start gap-12 lg:grid-cols-[minmax(320px,480px)_minmax(0,1fr)] max-lg:gap-8">
          <div className="grid min-h-[620px] grid-cols-[22px_minmax(0,1fr)_22px] overflow-hidden rounded-[24px] border-[3px] border-ink bg-ink shadow-[8px_9px_0_#a98cf4] max-sm:min-h-[520px]">
            <span className="film-perf bg-cream/15" aria-hidden="true" />
            <div className="relative min-w-0 overflow-hidden border-x-2 border-cream/80 bg-ink">
              {ready ? (
                <video
                  aria-label={`${video.petName}'s Rarely video`}
                  autoPlay
                  className="block size-full object-cover"
                  controls
                  loop
                  playsInline
                  poster={video.photoUrl}
                  preload="metadata"
                  src={video.videoUrl || undefined}
                />
              ) : (
                <>
                  <Image
                    alt=""
                    className="object-cover"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 480px"
                    src={video.photoUrl}
                    unoptimized
                  />
                  <StudioVideoPending analysisId={video.analysisId} initialFailed={failed} />
                </>
              )}
            </div>
            <span className="film-perf bg-cream/15" aria-hidden="true" />
          </div>

          <div className="pt-6 max-lg:pt-0">
            <span className="inline-flex rounded-md border-2 border-ink bg-yellow px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-wider shadow-[2px_2px_0_#241a44]">
              {ready ? "Ready" : failed ? "Failed" : "Generating"}
            </span>
            <h1 className="mt-6 font-display text-[clamp(2.75rem,7vw,5rem)] font-normal leading-[0.9] tracking-[-0.035em] text-pink">
              {video.petName}&apos;s video
            </h1>
            {video.dialogue && (
              <blockquote className="my-8 border-l-4 border-purple pl-5 text-xl font-black leading-snug text-ink-muted">
                “{video.dialogue}”
              </blockquote>
            )}
            {ready ? (
              <>
                <StudioVideoActions petName={video.petName} videoUrl={video.videoUrl!} />
                <p className="mt-5 max-w-md text-sm font-bold text-ink-muted">Your photo stays private.</p>
                <StudioVideoFeedback videoId={video.id} />
              </>
            ) : failed ? (
              <div className="max-w-md rounded-xl border-2 border-pink/30 bg-white p-4 text-sm font-bold leading-relaxed text-ink-muted">
                <p>{video.canRetry ? "Generation failed. Retry the same video without using another credit." : "Generation failed after all retry attempts."}</p>
                {video.canRetry && <StudioVideoRetry analysisId={video.analysisId} />}
              </div>
            ) : (
              <p className="max-w-md rounded-xl border-2 border-ink/15 bg-white p-4 text-sm font-bold leading-relaxed text-ink-muted">
                Usually ready in a few minutes. You can leave this page.
              </p>
            )}
            <Link
              className="mt-9 inline-flex min-h-11 items-center font-mono text-[9px] font-bold uppercase tracking-wider text-pink underline decoration-2 underline-offset-4"
              href="/studio/talking-pet"
            >
              New video →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
