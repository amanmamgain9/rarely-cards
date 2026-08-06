import Link from "next/link";

export default function VideoNotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6 text-center text-ink">
      <div>
        <h1 className="font-display text-4xl font-normal">Video not found.</h1>
        <p className="mx-auto mt-4 max-w-md font-bold text-ink-muted">It may have been removed.</p>
        <Link className="mt-7 inline-flex min-h-12 items-center rounded-xl border-2 border-ink bg-pink px-5 font-black text-white shadow-[3px_3px_0_#241a44]" href="/studio">
          Back to videos
        </Link>
      </div>
    </main>
  );
}
