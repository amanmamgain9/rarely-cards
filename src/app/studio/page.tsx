import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StudioHeader } from "@/components/studio-header";
import { StudioDraftCard } from "@/components/studio-draft-card";
import { Film } from "@/components/rarity/rarity-icons";
import { requireUser } from "@/lib/auth";
import { ensureDevelopmentVideoCredits } from "@/lib/payments/development-credits";
import {
  getStudioCreditBalance,
  getStudioDrafts,
  getStudioVideos,
} from "@/lib/studio/videos";

export const metadata: Metadata = {
  title: "Your videos — Rarely",
  description: "Continue drafts and manage your videos.",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function statusLabel(status: "submitting" | "running" | "succeeded") {
  return status === "succeeded" ? "Ready" : "Generating";
}

export default async function StudioPage() {
  const { user } = await requireUser();
  if (!user) redirect("/?signin=1");
  await ensureDevelopmentVideoCredits(user.id);

  const [videos, allDrafts, creditBalance] = await Promise.all([
    getStudioVideos(user.id),
    getStudioDrafts(user.id),
    getStudioCreditBalance(user.id),
  ]);
  const videoAnalysisIds = new Set(videos.map((video) => video.analysisId));
  const drafts = allDrafts.filter((draft) => !videoAnalysisIds.has(draft.id));
  if (videos.length === 0 && drafts.length === 0) {
    redirect("/studio/generate");
  }

  return (
    <main className="min-h-svh bg-background text-ink">
      <StudioHeader creditBalance={creditBalance} />
      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-[1120px] pb-20 pt-12 max-sm:w-[calc(100%-1.75rem)] max-sm:pb-12 max-sm:pt-8">
        <h1 className="sr-only">Studio</h1>

        {drafts.length > 0 && (
          <section aria-labelledby="drafts-heading">
            <h2 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-normal" id="drafts-heading">Drafts</h2>

            <div className="mt-5 grid grid-cols-2 gap-5 max-md:grid-cols-1">
              {drafts.map((draft) => (
                <StudioDraftCard draft={draft} key={draft.id} />
              ))}
            </div>
          </section>
        )}

        {videos.length > 0 && <section className={drafts.length > 0 ? "mt-14" : ""} aria-labelledby="videos-heading">
          <h2 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-normal" id="videos-heading">
            Videos
          </h2>
          <div className="mt-5 grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {videos.map((video) => (
              <Link
                className="group overflow-hidden rounded-[24px] border-[3px] border-ink bg-cream shadow-[6px_7px_0_#a98cf4] transition-transform hover:-translate-y-1"
                href={`/studio/videos/${video.id}`}
                key={video.id}
              >
                <div className="grid h-[310px] grid-cols-[18px_minmax(0,1fr)_18px] overflow-hidden border-b-[3px] border-ink bg-ink">
                  <span className="film-perf bg-cream/15" aria-hidden="true" />
                  <div className="relative min-w-0 overflow-hidden border-x-2 border-cream/80 bg-ink">
                    <Image
                      alt={`${video.petName}'s video cover`}
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      src={video.photoUrl}
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-transparent to-transparent" />
                    <span className="absolute bottom-4 left-1/2 grid size-12 -translate-x-1/2 place-items-center rounded-full border-2 border-ink bg-yellow text-ink shadow-[3px_3px_0_#f4458f] [&>svg]:w-6">
                      {video.status === "succeeded" ? <Film /> : <span className="size-6 animate-spin rounded-full border-[3px] border-ink/20 border-t-ink" />}
                    </span>
                  </div>
                  <span className="film-perf bg-cream/15" aria-hidden="true" />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-wider ${video.status === "succeeded" ? "bg-purple/20 text-ink" : "bg-yellow text-ink"}`}>
                      {statusLabel(video.status)}
                    </span>
                    <time className="font-mono text-[8px] text-ink-muted" dateTime={video.createdAt}>
                      {dateFormatter.format(new Date(video.createdAt))}
                    </time>
                  </div>
                  <h3 className="mt-4 truncate font-display text-xl font-normal text-pink">{video.petName}</h3>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm font-bold leading-snug text-ink-muted">
                    {video.dialogue ? `“${video.dialogue}”` : "Generating…"}
                  </p>
                </div>
              </Link>
            ))}
          </div>

        </section>
        }
      </section>
    </main>
  );
}
