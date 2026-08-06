"use client";

import { useEffect, useState } from "react";

type InstagramDevice = "android" | "ios" | "other" | null;

function getInstagramDevice(): InstagramDevice {
  const userAgent = navigator.userAgent;
  if (!/Instagram/i.test(userAgent)) return null;
  return /Android/i.test(userAgent)
    ? "android"
    : /iPhone|iPad|iPod/i.test(userAgent)
      ? "ios"
      : "other";
}

export function InstagramBrowserHandoff() {
  const [device, setDevice] = useState<InstagramDevice>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDevice(getInstagramDevice()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!device || dismissed) return null;

  function openAndroidBrowser() {
    const current = new URL(window.location.href);
    const intent = `intent://${current.host}${current.pathname}${current.search}#Intent;scheme=${current.protocol.slice(0, -1)};package=com.android.chrome;end`;
    window.location.assign(intent);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  }

  return (
    <aside className="sticky top-3 z-50 mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-[720px] items-center gap-3 rounded-2xl border-[3px] border-ink bg-yellow px-4 py-3 text-ink shadow-[4px_5px_0_#241a44]" aria-label="Open Rarely in your browser">
      <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-cream text-lg" aria-hidden="true">↗</span>
      <div className="min-w-0 flex-1">
        <strong className="block text-sm font-black">Uploads work better in your browser.</strong>
        <span className="block text-xs font-bold text-ink-muted">
          {device === "ios" ? "Tap •••, then Open in browser—or copy this link." : "Leave Instagram before adding your pet photos."}
        </span>
      </div>
      {device === "android" ? (
        <button className="shrink-0 rounded-xl border-2 border-ink bg-pink px-3 py-2 text-xs font-black text-white" type="button" onClick={openAndroidBrowser}>
          Open
        </button>
      ) : (
        <button className="shrink-0 rounded-xl border-2 border-ink bg-cream px-3 py-2 text-xs font-black" type="button" onClick={() => void copyLink()}>
          {copied ? "Copied" : "Copy link"}
        </button>
      )}
      <button className="grid size-8 shrink-0 place-items-center text-xl font-black" type="button" onClick={() => setDismissed(true)} aria-label="Dismiss browser suggestion">×</button>
    </aside>
  );
}
