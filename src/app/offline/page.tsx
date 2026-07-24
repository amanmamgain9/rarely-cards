import Link from "next/link";

export const metadata = {
  title: "Offline — Rarely",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <span className="pixel-label">CONNECTION PAUSED</span>
      <h1>Rare, but not available offline.</h1>
      <p>
        Rarely needs a connection to sign you in, read a pet photo, and keep
        purchases in sync.
      </p>
      <Link href="/">Try again</Link>
    </main>
  );
}
