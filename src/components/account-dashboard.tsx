"use client";

import { initializePaddle } from "@paddle/paddle-js";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountCard, AccountData, AccountPurchase } from "@/lib/account-types";
import { clearPendingPhoto } from "@/lib/pending-photo";
import { createClient } from "@/lib/supabase/client";
import { createShareAsset, ShareCard } from "@/components/share-card";

type AccountDashboardProps = {
  paddleConfigured: boolean;
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
}: {
  card: AccountCard;
  onPhotoDeleted: () => void;
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
        <span>{date(purchase.purchasedAt || purchase.createdAt)}</span>
      </div>
      <div>
        <strong>{money(purchase.amountCents, purchase.currency)}</strong>
        <span>{purchase.creditsRemaining} unused · {purchase.status.replace("_", " ")}</span>
      </div>
      {refundable && (
        <button type="button" disabled={busy} onClick={() => void requestRefund()}>
          {busy ? "Requesting…" : "Request full refund"}
        </button>
      )}
      {message && <p className="account-message" role="status">{message}</p>}
    </li>
  );
}

export function AccountDashboard({
  paddleConfigured,
  paddleEnvironment,
}: AccountDashboardProps) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  async function confirmPurchase(previousBalance: number) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const next = await refresh().catch(() => null);
      if (next && next.creditBalance >= previousBalance + 5) {
        setMessage("Five new card credits are ready.");
        setBuying(false);
        return;
      }
    }
    setMessage("Payment is complete. Paddle is still confirming your credits; refresh shortly.");
    setBuying(false);
  }

  async function buyCredits() {
    if (!paddleConfigured) {
      setMessage("Checkout is not configured yet.");
      return;
    }
    setBuying(true);
    setMessage(null);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || "Checkout could not be opened.");
      setBuying(false);
      return;
    }
    const previousBalance = account?.creditBalance ?? 0;
    const paddle = await initializePaddle({
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!,
      environment: paddleEnvironment,
      eventCallback: (event) => {
        if (event.name === "checkout.completed") {
          setMessage("Payment complete. Adding five credits…");
          void confirmPurchase(previousBalance);
        } else if (event.name === "checkout.closed") {
          setBuying(false);
        }
      },
      checkout: {
        settings: {
          displayMode: "overlay",
          theme: "light",
          showAddDiscounts: false,
        },
      },
    });
    paddle?.Checkout.open({ transactionId: payload.transactionId });
  }

  async function signOut() {
    await createClient().auth.signOut();
    localStorage.removeItem("rarely-analysis-id");
    await clearPendingPhoto().catch(() => undefined);
    window.location.href = "/";
  }

  function continueCard(id: string) {
    localStorage.setItem("rarely-analysis-id", id);
    window.location.assign("/");
  }

  if (loading) {
    return <main className="account-page account-loading">Loading your cards…</main>;
  }

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
          <button type="button" disabled={buying} onClick={() => void buyCredits()}>
            {buying ? "Opening checkout…" : "Buy 5 more — $5"}
          </button>
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
              <SavedCard card={card} key={card.id} onPhotoDeleted={() => void refresh()} />
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
