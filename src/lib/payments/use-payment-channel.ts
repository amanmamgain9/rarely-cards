"use client";

import { useEffect, useState } from "react";

export type PaymentChannel =
  | "loading"
  | "web"
  | "google_play"
  | "play_unavailable";

const PLAY_MARKER = "rarely-google-play-session";
const PLAY_BILLING_METHOD = "https://play.google.com/billing";

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
      if (typeof window.getDigitalGoodsService === "function") {
        try {
          await window.getDigitalGoodsService(PLAY_BILLING_METHOD);
          if (!cancelled) setChannel("google_play");
          return;
        } catch {
          // A Play launch must fail closed instead of exposing web checkout.
        }
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
