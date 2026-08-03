"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountData, AccountPurchase } from "@/lib/account-types";
import {
  getGooglePlayProduct,
  restoreGooglePlayPurchases,
  startGooglePlayPurchase,
} from "@/lib/payments/google-play-client";
import { PADDLE_CHECKOUT_COMPLETED_EVENT } from "@/lib/payments/paddle-client-events";
import { usePaymentChannel } from "@/lib/payments/use-payment-channel";

type AccountBillingProps = {
  paddleConfigured: boolean;
  googlePlayConfigured: boolean;
  seedanceConfigured: boolean;
  paddleEnvironment: "sandbox" | "production";
};

function money(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function date(value: string | null) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function providerName(provider: AccountPurchase["paymentProvider"]) {
  if (provider === "google_play") return "Google Play";
  if (provider === "lemon_squeezy") return "Lemon Squeezy";
  return "Paddle";
}

function PurchaseRow({
  purchase,
  onRefunded,
}: {
  purchase: AccountPurchase;
  onRefunded: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function requestRefund() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/purchases/${purchase.id}/refund`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.message || payload.error || null);
      if (response.ok) onRefunded();
    } catch {
      setMessage("The refund request could not be sent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border-t border-ink/10 first:border-t-0">
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <strong>{purchase.creditsGranted} video credits</strong>
            <span className="font-mono text-[9px] uppercase tracking-wide text-ink-muted">
              {providerName(purchase.paymentProvider)} · {date(purchase.purchasedAt || purchase.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-xs font-bold text-ink-muted">
            {purchase.creditsRemaining} unused · {purchase.status.replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <strong className="min-w-16 sm:text-right">{money(purchase.amountCents, purchase.currency)}</strong>
          {purchase.refundable && (
            <button
              className="min-h-9 rounded-lg border border-ink/20 bg-cream px-3 text-xs font-extrabold text-ink hover:border-ink disabled:cursor-wait disabled:opacity-60"
              disabled={busy}
              onClick={() => void requestRefund()}
              type="button"
            >
              {busy
                ? "Requesting…"
                : purchase.status === "refund_pending"
                  ? "Retry refund"
                  : "Request refund"}
            </button>
          )}
        </div>
      </div>
      {message && (
        <p className="border-t border-ink/10 bg-[#bdeef5]/45 px-5 py-3 text-xs font-extrabold text-ink" role="status">
          {message}
        </p>
      )}
    </li>
  );
}

export function AccountBilling({
  paddleConfigured,
  googlePlayConfigured,
  seedanceConfigured,
  paddleEnvironment,
}: AccountBillingProps) {
  const paymentChannel = usePaymentChannel();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [playPrice, setPlayPrice] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const playRestoreAttempted = useRef(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/";
      return null;
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Billing could not be loaded.");
    setAccount(payload as AccountData);
    return payload as AccountData;
  }, []);

  const fetchCreditBalance = useCallback(async (transactionId?: string) => {
    const params = new URLSearchParams({ view: "balance" });
    if (transactionId) params.set("transactionId", transactionId);
    const response = await fetch(`/api/account?${params}`, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    if (typeof payload.creditBalance !== "number") return null;
    return {
      creditBalance: payload.creditBalance,
      transactionConfirmed: payload.transactionConfirmed === true,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/account", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/";
          return null;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Billing could not be loaded.");
        if (!cancelled) setAccount(payload as AccountData);
        return payload as AccountData;
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Billing could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmPurchase = useCallback(async (
    previousBalance: number,
    transactionId?: string,
  ) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const next = await fetchCreditBalance(transactionId).catch(() => null);
      const confirmed = transactionId
        ? next?.transactionConfirmed === true
        : next !== null && next.creditBalance >= previousBalance + 3;
      if (confirmed) {
        await refresh().catch(() => null);
        setMessage("Three new video credits are ready.");
        setBuying(false);
        return;
      }
    }
    setMessage("Payment is complete. Your credits are still being confirmed; refresh shortly.");
    setBuying(false);
  }, [fetchCreditBalance, refresh]);

  useEffect(() => {
    const handleHostedCheckoutCompleted = (event: Event) => {
      const transactionId = (
        event as CustomEvent<{ transactionId?: string }>
      ).detail?.transactionId;
      if (!transactionId) return;
      setBuying(true);
      setMessage("Payment complete. Adding three video credits…");
      void confirmPurchase(account?.creditBalance ?? 0, transactionId);
    };
    window.addEventListener(PADDLE_CHECKOUT_COMPLETED_EVENT, handleHostedCheckoutCompleted);
    return () =>
      window.removeEventListener(PADDLE_CHECKOUT_COMPLETED_EVENT, handleHostedCheckoutCompleted);
  }, [account?.creditBalance, confirmPurchase]);

  useEffect(() => {
    if (paymentChannel !== "google_play") return;
    let cancelled = false;
    void getGooglePlayProduct()
      .then((product) => {
        if (!cancelled) setPlayPrice(product.formattedPrice);
      })
      .catch(() => {
        if (!cancelled) setPlayPrice(null);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentChannel]);

  useEffect(() => {
    if (paymentChannel !== "google_play" || playRestoreAttempted.current) return;
    playRestoreAttempted.current = true;
    void restoreGooglePlayPurchases()
      .then((restored) => {
        if (restored.length > 0) {
          setMessage("A Google Play purchase was restored.");
          void refresh();
        }
      })
      .catch(() => undefined);
  }, [paymentChannel, refresh]);

  async function buyCredits(provider: "paddle" | "google_play") {
    if (buying) return;
    if (
      (provider === "paddle" && !paddleConfigured) ||
      (provider === "google_play" &&
        (paymentChannel !== "google_play" || !googlePlayConfigured))
    ) {
      setMessage("Checkout is not configured yet.");
      return;
    }

    setBuying(true);
    setMessage(null);
    let response: Response;
    try {
      response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
    } catch {
      setMessage("Checkout could not be opened. Check your connection and try again.");
      setBuying(false);
      return;
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || "Checkout could not be opened.");
      setBuying(false);
      return;
    }

    const previousBalance = account?.creditBalance ?? 0;
    if (provider === "google_play") {
      try {
        await startGooglePlayPurchase({ purchaseId: payload.purchaseId });
        setMessage("Payment complete. Adding three video credits…");
        void confirmPurchase(previousBalance);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setBuying(false);
          return;
        }
        setMessage(error instanceof Error ? error.message : "Google Play checkout could not be completed.");
        setBuying(false);
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
            setMessage("Payment complete. Adding three video credits…");
            void confirmPurchase(previousBalance, payload.transactionId);
          } else if (event.name === "checkout.closed") {
            setBuying(false);
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
      setMessage("Checkout could not be opened. Try again.");
      setBuying(false);
    }
  }

  const checkoutAvailable =
    seedanceConfigured &&
    ((paymentChannel === "google_play" && googlePlayConfigured) ||
      (paymentChannel === "web" && paddleConfigured));
  const primaryProvider = paymentChannel === "google_play" ? "google_play" : "paddle";
  const checkoutPrice =
    paymentChannel === "google_play" ? playPrice : paymentChannel === "web" ? "$10" : null;
  const purchases =
    account?.purchases.filter((purchase) => purchase.creditKind === "talking_video") ?? [];

  return (
    <section aria-labelledby="billing-heading">
      <div className="mb-9">
        <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-pink">
          Credits and payments
        </p>
        <h1 id="billing-heading" className="font-display text-[clamp(2rem,5vw,3rem)] font-normal leading-none">
          Billing
        </h1>
        <p className="mt-3 max-w-xl text-sm font-bold leading-relaxed text-ink-muted">
          Buy video credits, check your balance, and manage past purchases.
        </p>
      </div>

      {message && (
        <p className="mb-6 rounded-xl border border-ink/15 bg-[#bdeef5] px-5 py-4 text-sm font-extrabold" role="status">
          {message}
        </p>
      )}

      <section className="relative overflow-hidden rounded-2xl border-2 border-ink bg-yellow shadow-[5px_5px_0_#241a44]" aria-labelledby="balance-heading">
        <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em]">Available now</p>
            <div className="mt-2 flex items-end gap-3">
              <strong id="balance-heading" className="font-display text-6xl font-normal leading-[0.9]">
                {loading ? "—" : account?.developmentMode ? "∞" : account?.creditBalance ?? 0}
              </strong>
              <span className="pb-1 text-sm font-black">
                {account?.developmentMode ? "development mode" : "video credits"}
              </span>
            </div>
            <p className="mt-3 text-sm font-bold text-ink-muted">
              {account?.developmentMode
                ? "Video creation is free locally. Checkout is disabled."
                : "One credit creates one talking-pet video."}
            </p>
          </div>

          {!account?.developmentMode && (
            <button
              className="min-h-12 rounded-xl border-2 border-ink bg-pink px-5 text-sm font-black text-white shadow-[3px_3px_0_#241a44] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={buying || loading || !checkoutAvailable}
              onClick={() => void buyCredits(primaryProvider)}
              type="button"
            >
              {buying
                ? "Opening checkout…"
                : paymentChannel === "loading"
                  ? "Preparing checkout…"
                  : paymentChannel === "play_unavailable"
                    ? "Google Play unavailable"
                    : paymentChannel === "google_play" && !googlePlayConfigured
                      ? "Checkout unavailable"
                      : `Buy 3 credits${checkoutPrice ? ` — ${checkoutPrice}` : ""}`}
            </button>
          )}
        </div>
        <div className="h-2 border-t-2 border-dashed border-ink/30 bg-cream/40" aria-hidden="true" />
      </section>

      {paymentChannel === "play_unavailable" && (
        <p className="mt-4 text-xs font-extrabold text-ink-muted">
          Update Chrome or reopen Rarely from Google Play to buy credits.
        </p>
      )}
      {!seedanceConfigured && !account?.developmentMode && (
        <p className="mt-4 text-xs font-extrabold text-ink-muted">
          Talking-pet video checkout is temporarily unavailable.
        </p>
      )}

      <section aria-labelledby="purchase-history-heading" className="mt-12">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="purchase-history-heading" className="text-lg font-black">Purchase history</h2>
          {!loading && purchases.length > 0 && (
            <span className="font-mono text-[10px] text-ink-muted">{purchases.length} total</span>
          )}
        </div>

        {loading ? (
          <div className="h-28 animate-pulse rounded-2xl bg-white" aria-label="Loading purchases" role="status" />
        ) : purchases.length > 0 ? (
          <ul className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
            {purchases.map((purchase) => (
              <PurchaseRow purchase={purchase} key={purchase.id} onRefunded={() => void refresh()} />
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 px-6 py-9 text-center">
            <strong className="block">No purchases yet</strong>
            <p className="mt-1 text-sm font-bold text-ink-muted">Your credit purchases will appear here.</p>
          </div>
        )}
      </section>
    </section>
  );
}
