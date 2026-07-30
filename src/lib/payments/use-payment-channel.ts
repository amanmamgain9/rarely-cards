"use client";

import { useSyncExternalStore } from "react";
import { getGooglePlayProduct } from "@/lib/payments/google-play-client";

export type PaymentChannel =
  | "loading"
  | "web"
  | "google_play"
  | "play_unavailable";

const PLAY_MARKER = "rarely-google-play-session";
const PLAY_BILLING_METHOD = "https://play.google.com/billing";
let digitalGoodsProbe: Promise<boolean> | null = null;

type PaymentRuntimeSnapshot = {
  channel: PaymentChannel;
  playPrice: string | null;
};

const SERVER_SNAPSHOT: PaymentRuntimeSnapshot = {
  channel: "loading",
  playPrice: null,
};
let runtimeSnapshot = SERVER_SNAPSHOT;
let runtimeStarted = false;
const runtimeListeners = new Set<() => void>();

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

function publishRuntime(next: PaymentRuntimeSnapshot) {
  runtimeSnapshot = next;
  runtimeListeners.forEach((listener) => listener());
}

async function startPaymentRuntime() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("source") === "google-play") {
    sessionStorage.setItem(PLAY_MARKER, "1");
  }
  const launchedFromPlay = sessionStorage.getItem(PLAY_MARKER) === "1";

  let hasBilling = await hasGooglePlayBilling();
  if (!hasBilling && launchedFromPlay) {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    hasBilling = await hasGooglePlayBilling();
  }
  if (!hasBilling) {
    publishRuntime({
      channel: launchedFromPlay ? "play_unavailable" : "web",
      playPrice: null,
    });
    return;
  }

  publishRuntime({ channel: "google_play", playPrice: null });
  const playPrice = await getGooglePlayProduct()
    .then((product) => product.formattedPrice)
    .catch(() => null);
  publishRuntime({ channel: "google_play", playPrice });
}

function subscribePaymentRuntime(listener: () => void) {
  runtimeListeners.add(listener);
  if (!runtimeStarted) {
    runtimeStarted = true;
    void startPaymentRuntime().catch(() => {
      publishRuntime({ channel: "web", playPrice: null });
    });
  }
  return () => runtimeListeners.delete(listener);
}

function getPaymentRuntimeSnapshot() {
  return runtimeSnapshot;
}

function getServerPaymentRuntimeSnapshot() {
  return SERVER_SNAPSHOT;
}

export function usePaymentRuntime(): PaymentRuntimeSnapshot {
  return useSyncExternalStore(
    subscribePaymentRuntime,
    getPaymentRuntimeSnapshot,
    getServerPaymentRuntimeSnapshot,
  );
}

export function usePaymentChannel(): PaymentChannel {
  return usePaymentRuntime().channel;
}
