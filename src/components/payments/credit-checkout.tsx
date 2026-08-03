"use client";

import { useState } from "react";
import {
  restoreGooglePlayPurchases,
  startGooglePlayPurchase,
} from "@/lib/payments/google-play-client";
import { usePaymentRuntime } from "@/lib/payments/use-payment-channel";

type CheckoutProvider = "paddle" | "google_play";

export function CreditCheckout({
  analysisId,
  currentBalance,
  paddleConfigured,
  googlePlayConfigured,
  seedanceConfigured,
  paddleEnvironment,
  redirectTo,
  onConfirmed,
}: {
  analysisId?: string;
  currentBalance: number;
  paddleConfigured: boolean;
  googlePlayConfigured: boolean;
  seedanceConfigured: boolean;
  paddleEnvironment: "sandbox" | "production";
  redirectTo?: string;
  onConfirmed?: () => void | Promise<void>;
}) {
  const { channel, playPrice } = usePaymentRuntime();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const provider: CheckoutProvider =
    channel === "google_play" ? "google_play" : "paddle";
  const price =
    channel === "google_play" ? playPrice : channel === "web" ? "$10" : null;
  const available =
    seedanceConfigured &&
    ((channel === "google_play" && googlePlayConfigured) ||
      (channel === "web" && paddleConfigured));

  async function creditPurchaseIsReady(transactionId?: string) {
    const params = new URLSearchParams({ view: "balance" });
    if (transactionId) params.set("transactionId", transactionId);
    const response = await fetch(`/api/account?${params}`, { cache: "no-store" });
    if (!response.ok) return false;
    const payload = await response.json();
    return transactionId
      ? payload.transactionConfirmed === true
      : typeof payload.creditBalance === "number" &&
          payload.creditBalance >= currentBalance + 3;
  }

  async function finishPurchase(transactionId?: string) {
    setMessage("Payment complete. Adding your video credits…");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await creditPurchaseIsReady(transactionId).catch(() => false)) {
        await onConfirmed?.();
        if (redirectTo) window.location.assign(redirectTo);
        else {
          setMessage("Three new video credits are ready.");
          setBusy(false);
          setRestoring(false);
        }
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1_500));
    }
    setMessage("Payment is complete. Your credits are still being confirmed; refresh shortly.");
    setBusy(false);
    setRestoring(false);
  }

  async function buyCredits() {
    if (busy || !available) return;
    setBusy(true);
    setMessage(null);

    let response: Response;
    try {
      response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...(analysisId ? { analysisId } : {}) }),
      });
    } catch {
      setMessage("Checkout could not be opened. Check your connection and try again.");
      setBusy(false);
      return;
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || "Checkout could not be opened.");
      setBusy(false);
      return;
    }

    if (provider === "google_play") {
      try {
        await startGooglePlayPurchase({
          purchaseId: payload.purchaseId,
          ...(analysisId ? { analysisId } : {}),
        });
        await finishPurchase();
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Google Play checkout could not be completed.",
          );
        }
        setBusy(false);
      }
      return;
    }

    try {
      const { initializePaddle } = await import("@paddle/paddle-js");
      const paddle = await initializePaddle({
        token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!,
        environment: paddleEnvironment,
        eventCallback: (event) => {
          if (event.name === "checkout.completed") {
            void finishPurchase(payload.transactionId);
          } else if (event.name === "checkout.closed") {
            setBusy(false);
          }
        },
        checkout: {
          settings: {
            displayMode: "overlay",
            theme: "light",
            allowLogout: false,
            showAddDiscounts: false,
          },
        },
      });
      if (!paddle) throw new Error("paddle_not_initialized");
      paddle.Checkout.open({ transactionId: payload.transactionId });
    } catch {
      setMessage("Checkout could not be opened. Please try again.");
      setBusy(false);
    }
  }

  async function restorePurchases() {
    if (busy || restoring) return;
    setRestoring(true);
    setMessage(null);
    try {
      const restored = await restoreGooglePlayPurchases(analysisId);
      if (restored.length === 0) {
        setMessage("No Rarely purchases were found to restore.");
        setRestoring(false);
        return;
      }
      await finishPurchase();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Google Play purchases could not be restored.",
      );
      setRestoring(false);
    }
  }

  const label = busy
    ? "Opening checkout…"
    : channel === "loading"
      ? "Preparing checkout…"
      : channel === "play_unavailable"
        ? "Google Play unavailable"
        : !available
          ? "Checkout temporarily unavailable"
          : `Buy 3 video credits${price ? ` — ${price}` : ""}`;

  return (
    <div>
      <button
        className="min-h-12 w-full rounded-xl border-2 border-ink bg-pink px-5 text-sm font-black text-white shadow-[3px_3px_0_#241a44] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
        disabled={busy || restoring || !available}
        onClick={() => void buyCredits()}
        type="button"
      >
        {label}
      </button>
      {channel === "google_play" && googlePlayConfigured && (
        <button
          className="mt-3 w-full text-xs font-black text-ink-muted underline decoration-2 underline-offset-4 hover:text-pink disabled:opacity-60"
          disabled={busy || restoring}
          onClick={() => void restorePurchases()}
          type="button"
        >
          {restoring ? "Restoring purchases…" : "Restore Google Play purchase"}
        </button>
      )}
      {channel === "play_unavailable" && (
        <p className="mt-3 text-xs font-bold text-ink-muted">
          Update Chrome or reopen Rarely from Google Play to buy credits.
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-xl border border-ink/15 bg-[#bdeef5] px-4 py-3 text-sm font-extrabold" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
