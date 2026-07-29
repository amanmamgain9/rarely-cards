"use client";

import { useEffect, useState } from "react";

export type PaymentChannel =
  | "loading"
  | "web"
  | "google_play"
  | "play_unavailable";

const PLAY_MARKER = "rarely-google-play-session";
const PLAY_BILLING_METHOD = "https://play.google.com/billing";
let digitalGoodsProbe: Promise<boolean> | null = null;

async function hasGooglePlayBilling() {
  if (typeof window.getDigitalGoodsService !== "function") {
    return false;
  }
  const probe =
    digitalGoodsProbe ??
    window.getDigitalGoodsService(PLAY_BILLING_METHOD).then(() => true);
  digitalGoodsProbe = probe;
  try {
    return await probe;
  } catch {
    // Billing can reject while the TWA bridge is still starting. Do not cache
    // that transient result for the rest of the browser tab.
    if (digitalGoodsProbe === probe) digitalGoodsProbe = null;
    return false;
  }
}

export function usePaymentChannel(): PaymentChannel {
  const [channel, setChannel] = useState<PaymentChannel>("loading");

  useEffect(() => {
    let cancelled = false;
    const url = new URL(window.location.href);
    if (url.searchParams.get("source") === "google-play") {
      sessionStorage.setItem(PLAY_MARKER, "1");
    }
    const launchedFromPlay = sessionStorage.getItem(PLAY_MARKER) === "1";

    void (async () => {
      let hasBilling = await hasGooglePlayBilling();
      if (!hasBilling && launchedFromPlay) {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        hasBilling = await hasGooglePlayBilling();
      }
      if (hasBilling) {
        if (!cancelled) setChannel("google_play");
        return;
      }
      if (!cancelled) {
        setChannel(launchedFromPlay ? "play_unavailable" : "web");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return channel;
}
