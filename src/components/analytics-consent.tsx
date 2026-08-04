"use client";

import { useEffect, useState } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

const CONSENT_KEY = "rarely_analytics_consent";

type Consent = "accepted" | "declined" | "loading" | null;

export function AnalyticsConsent({ measurementId }: { measurementId: string }) {
  const [consent, setConsent] = useState<Consent>("loading");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = window.localStorage.getItem(CONSENT_KEY);
      setConsent(stored === "accepted" || stored === "declined" ? stored : null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function choose(nextConsent: "accepted" | "declined") {
    window.localStorage.setItem(CONSENT_KEY, nextConsent);
    setConsent(nextConsent);
  }

  return (
    <>
      {consent === "accepted" ? <GoogleAnalytics gaId={measurementId} /> : null}
      {consent === null ? (
        <aside className="fixed inset-x-4 bottom-4 z-[140] mx-auto grid max-w-3xl gap-4 rounded-2xl border-[3px] border-ink bg-cream p-5 text-ink shadow-[7px_8px_0_#241a44] sm:grid-cols-[1fr_auto] sm:items-center" aria-label="Analytics preference">
          <div>
            <strong className="font-display text-base font-normal">HELP US SEE WHAT WORKS?</strong>
            <p className="mb-0 mt-1 text-xs font-bold leading-relaxed text-ink-muted">
              Optional Google Analytics measures page use and conversion steps. We never send pet photos, names, lines, videos, or email addresses.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="min-h-10 rounded-lg border-2 border-ink bg-white px-3 font-mono text-[9px] font-bold uppercase focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-purple" type="button" onClick={() => choose("declined")}>No thanks</button>
            <button className="min-h-10 rounded-lg border-2 border-ink bg-yellow px-3 font-mono text-[9px] font-bold uppercase shadow-[2px_3px_0_#241a44] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-pink" type="button" onClick={() => choose("accepted")}>Allow analytics</button>
          </div>
        </aside>
      ) : null}
    </>
  );
}
