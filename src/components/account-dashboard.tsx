"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountCard, AccountData, AccountPurchase } from "@/lib/account-types";
import {
  getGooglePlayProduct,
  restoreGooglePlayPurchases,
  startGooglePlayPurchase,
} from "@/lib/payments/google-play-client";
import { PADDLE_CHECKOUT_COMPLETED_EVENT } from "@/lib/payments/paddle-client-events";
import { usePaymentChannel } from "@/lib/payments/use-payment-channel";
import { clearPendingPhoto } from "@/lib/pending-photo";
import { createZazzlePrintCheckout } from "@/lib/printing/zazzle-client";
import { createShareAsset, ShareCard } from "@/components/share-card";

type AccountDashboardProps = {
  paddleConfigured: boolean;
  googlePlayConfigured: boolean;
  zazzlePrintEnabled: boolean;
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

function SavedCard({
  card,
  onPhotoDeleted,
  zazzlePrintEnabled,
}: {
  card: AccountCard;
  onPhotoDeleted: () => void;
  zazzlePrintEnabled: boolean;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function download() {
    if (!cardRef.current) return;
    setBusy(true);
    setMessage(null);
    try {
      const asset = await createShareAsset(cardRef.current);
      const anchor = document.createElement("a");
      anchor.href = asset.dataUrl;
      anchor.download = `${card.petName || "rarely"}-card.png`;
      anchor.click();
    } catch {
      setMessage("The card image could not be downloaded. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!cardRef.current) return;
    setBusy(true);
    setMessage(null);
    try {
      const asset = await createShareAsset(cardRef.current);
      if (navigator.share && navigator.canShare?.({ files: [asset.file] })) {
        await navigator.share({
          files: [asset.file],
          title: `${card.petName || "My pet"}'s Rarely card`,
        });
      } else {
        const anchor = document.createElement("a");
        anchor.href = asset.dataUrl;
        anchor.download = `${card.petName || "rarely"}-card.png`;
        anchor.click();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("The card could not be shared. Try downloading it instead.");
    } finally {
      setBusy(false);
    }
  }

  async function orderPrint() {
    if (!cardRef.current || !zazzlePrintEnabled) return;
    setBusy(true);
    setMessage(null);
    try {
      const asset = await createShareAsset(cardRef.current);
      const checkoutUrl = await createZazzlePrintCheckout(card.id, asset.file);
      window.location.assign(checkoutUrl);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Print checkout could not be opened.",
      );
      setBusy(false);
    }
  }

  async function deletePhoto() {
    if (!window.confirm("Delete this saved photo? The text result will remain.")) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/analyses/${card.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || "The photo could not be deleted.");
    } else {
      onPhotoDeleted();
    }
    setBusy(false);
  }

  return (
    <article className="account-card-item">
      <div className="account-card-frame">
        {card.photoUrl && card.result ? (
          <ShareCard ref={cardRef} photo={card.photoUrl} result={card.result} />
        ) : (
          <div className="account-card-missing">
            <span>PHOTO DELETED</span>
            <strong>{card.result?.cardTitle || card.petName || "Saved card"}</strong>
            <p>The result is still in your history.</p>
          </div>
        )}
      </div>
      <div className="account-card-actions">
        <div>
          <strong>{card.petName || "Your pet"}</strong>
          <span>{date(card.completedAt)}</span>
        </div>
        {card.photoUrl && card.result && (
          <>
            <button type="button" disabled={busy} onClick={() => void download()}>
              Download
            </button>
            <button type="button" disabled={busy} onClick={() => void share()}>
              Share
            </button>
            {zazzlePrintEnabled && (
              <button type="button" disabled={busy} onClick={() => void orderPrint()}>
                Order print
              </button>
            )}
            <button className="quiet" type="button" disabled={busy} onClick={() => void deletePhoto()}>
              Delete photo
            </button>
          </>
        )}
      </div>
      {message && <p className="account-message" role="alert">{message}</p>}
    </article>
  );
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
  const refundable = purchase.refundable;

  async function requestRefund() {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/purchases/${purchase.id}/refund`, {
      method: "POST",
    });
    const payload = await response.json().catch(() => ({}));
    setMessage(payload.message || payload.error || null);
    if (response.ok) onRefunded();
    setBusy(false);
  }

  return (
    <li>
      <div>
        <strong>5-card pack</strong>
        <span>
          {date(purchase.purchasedAt || purchase.createdAt)} ·{" "}
          {purchase.paymentProvider === "google_play"
            ? "Google Play"
            : purchase.paymentProvider === "lemon_squeezy"
              ? "Lemon Squeezy"
              : "Paddle"}
        </span>
      </div>
      <div>
        <strong>{money(purchase.amountCents, purchase.currency)}</strong>
        <span>{purchase.creditsRemaining} unused · {purchase.status.replace("_", " ")}</span>
      </div>
      {refundable && (
        <button type="button" disabled={busy} onClick={() => void requestRefund()}>
          {busy
            ? "Requesting…"
            : purchase.status === "refund_pending"
              ? "Retry refund"
              : "Request full refund"}
        </button>
      )}
      {message && <p className="account-message" role="status">{message}</p>}
    </li>
  );
}

export function AccountDashboard({
  paddleConfigured,
  googlePlayConfigured,
  zazzlePrintEnabled,
  paddleEnvironment,
}: AccountDashboardProps) {
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
    if (!response.ok) throw new Error(payload.error || "Account could not be loaded.");
    setAccount(payload as AccountData);
    return payload as AccountData;
  }, []);

  const fetchCreditBalance = useCallback(async (transactionId?: string) => {
    const params = new URLSearchParams({ view: "balance" });
    if (transactionId) params.set("transactionId", transactionId);
    const response = await fetch(`/api/account?${params}`, {
      cache: "no-store",
    });
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
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Account could not be loaded.");
        }
        if (!cancelled) setAccount(payload as AccountData);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(
            error instanceof Error ? error.message : "Account could not be loaded.",
          );
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
        : next !== null && next.creditBalance >= previousBalance + 5;
      if (confirmed) {
        await refresh().catch(() => null);
        setMessage("Five new card credits are ready.");
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
      setMessage("Payment complete. Adding five credits…");
      void confirmPurchase(account?.creditBalance ?? 0, transactionId);
    };
    window.addEventListener(
      PADDLE_CHECKOUT_COMPLETED_EVENT,
      handleHostedCheckoutCompleted,
    );
    return () =>
      window.removeEventListener(
        PADDLE_CHECKOUT_COMPLETED_EVENT,
        handleHostedCheckoutCompleted,
      );
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
    if (
      paymentChannel !== "google_play" ||
      playRestoreAttempted.current
    ) {
      return;
    }
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

  async function buyCredits(
    provider: "paddle" | "google_play",
  ) {
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
        setMessage("Payment complete. Adding five credits…");
        void confirmPurchase(previousBalance);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setBuying(false);
          return;
        }
        setMessage(
          error instanceof Error
            ? error.message
            : "Google Play checkout could not be completed.",
        );
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
            setMessage("Payment complete. Adding five credits…");
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
      setMessage("Checkout could not be opened. Please try again.");
      setBuying(false);
    }
  }

  async function signOut() {
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    localStorage.removeItem("rarely-analysis-id");
    await clearPendingPhoto().catch(() => undefined);
    window.location.href = "/";
  }

  function continueCard(id: string) {
    localStorage.setItem("rarely-analysis-id", id);
    window.location.assign("/");
  }

  async function deleteSavedPhoto(card: AccountCard) {
    if (!window.confirm(`Delete the saved photo for ${card.petName || "this attempt"}?`)) {
      return;
    }
    setMessage(null);
    const response = await fetch(`/api/analyses/${card.id}`, {
      method: "DELETE",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || "The photo could not be deleted.");
      return;
    }
    setMessage("The saved photo was deleted. The result history remains.");
    await refresh();
  }

  if (loading) {
    return <main className="account-page account-loading">Loading your cards…</main>;
  }

  const checkoutAvailable =
    (paymentChannel === "google_play" && googlePlayConfigured) ||
    (paymentChannel === "web" && paddleConfigured);
  const primaryProvider =
    paymentChannel === "google_play"
      ? ("google_play" as const)
      : ("paddle" as const);
  const checkoutPrice =
    paymentChannel === "google_play" ? playPrice : paymentChannel === "web" ? "$5" : null;
  const completedCards = account?.cards.filter((card) => card.status === "completed") ?? [];
  const activity =
    account?.cards.filter((card) => card.status !== "completed") ?? [];
  const inProgress = activity.filter((card) =>
    ["awaiting_upload", "awaiting_payment", "awaiting_name", "paid", "processing"].includes(card.status),
  );
  const spentAttempts = activity.filter((card) =>
    ["photo_rejected", "failed"].includes(card.status),
  );

  return (
    <main className="account-page">
      <header className="account-nav">
        <Link className="public-brand" href="/">RARELY <span>★</span></Link>
        <nav>
          <Link href="/pricing">Pricing</Link>
          <Link href="/">Make a card</Link>
          <button type="button" onClick={() => void signOut()}>Sign out</button>
        </nav>
      </header>

      <section className="account-hero">
        <div>
          <span className="pixel-label">YOUR RARELY ACCOUNT</span>
          <h1>Your pets.<br /><em>Still unmistakable.</em></h1>
          <p>{account?.email}</p>
        </div>
        <aside>
          <span>CARD CREDITS</span>
          <strong>{account?.creditBalance ?? 0}</strong>
          <p>Each accepted or rejected AI response uses one credit. Technical failures do not.</p>
          <button
            type="button"
            disabled={buying || !checkoutAvailable}
            onClick={() => void buyCredits(primaryProvider)}
          >
            {buying
              ? "Opening checkout…"
              : paymentChannel === "loading"
                ? "Preparing secure checkout…"
                : paymentChannel === "play_unavailable"
                  ? "Google Play Billing unavailable"
                  : paymentChannel === "google_play" && !googlePlayConfigured
                    ? "Google Play checkout temporarily unavailable"
                  : `Buy 5 more${checkoutPrice ? ` — ${checkoutPrice}` : ""}`}
          </button>
          {paymentChannel === "play_unavailable" && (
            <p>Update Chrome or reopen Rarely from Google Play to buy credits.</p>
          )}
        </aside>
      </section>

      {message && <p className="account-banner" role="status">{message}</p>}

      {inProgress.length > 0 && (
        <section className="account-section">
          <div className="account-section-heading">
            <span>IN PROGRESS</span>
            <h2>Pick up where you left off.</h2>
          </div>
          <div className="account-progress-list">
            {inProgress.map((card) => (
              <article key={card.id}>
                <div><strong>{card.petName || "New card"}</strong><span>{card.status.replace("_", " ")}</span></div>
                <button type="button" onClick={() => continueCard(card.id)}>Continue →</button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="account-section">
        <div className="account-section-heading">
          <span>YOUR CARDS</span>
          <h2>The looks worth keeping.</h2>
        </div>
        {completedCards.length > 0 ? (
          <div className="account-card-grid">
            {completedCards.map((card) => (
              <SavedCard
                card={card}
                key={card.id}
                onPhotoDeleted={() => void refresh()}
                zazzlePrintEnabled={zazzlePrintEnabled}
              />
            ))}
          </div>
        ) : (
          <div className="account-empty">
            <strong>No finished cards yet.</strong>
            <p>Your first unmistakable look belongs here.</p>
            <Link href="/">Make a card →</Link>
          </div>
        )}
      </section>

      {spentAttempts.length > 0 && (
        <section className="account-section account-attempts">
          <div className="account-section-heading">
            <span>OTHER ATTEMPTS</span>
            <h2>AI responses and technical failures.</h2>
          </div>
          <ul>
            {spentAttempts.map((card) => (
              <li key={card.id}>
                <strong>{card.petName || "Photo attempt"}</strong>
                <span>
                  {card.status === "photo_rejected"
                    ? card.rejectionMessage || "The AI could not use this photo. One credit was used."
                    : "A technical failure occurred. The reserved credit was returned."}
                </span>
                {card.photoUrl && (
                  <button
                    type="button"
                    onClick={() => void deleteSavedPhoto(card)}
                  >
                    Delete photo
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="account-section account-purchases">
        <div className="account-section-heading">
          <span>PURCHASES</span>
          <h2>Five at a time. Yours until used.</h2>
        </div>
        {account?.purchases.length ? (
          <ul>
            {account.purchases.map((purchase) => (
              <PurchaseRow purchase={purchase} key={purchase.id} onRefunded={() => void refresh()} />
            ))}
          </ul>
        ) : (
          <div className="account-empty"><p>No purchases yet.</p></div>
        )}
      </section>

      <footer className="public-footer">
        <Link className="public-brand" href="/">RARELY <span>★</span></Link>
        <p>© 2026 Rarely · Operated by Aman Mamgain, sole proprietor.</p>
        <nav>
          <Link href="/refund-policy">Refunds</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </footer>
    </main>
  );
}
