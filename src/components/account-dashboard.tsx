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
import { PublicFooter } from "@/components/public-chrome";
import { clearPendingPhoto } from "@/lib/pending-photo";
import { createZazzlePrintCheckout } from "@/lib/printing/zazzle-client";
import {
  canUseNativeFileShare,
  createShareAsset,
  downloadShareAsset,
  ShareCard,
} from "@/components/share-card";

type AccountDashboardProps = {
  paddleConfigured: boolean;
  googlePlayConfigured: boolean;
  seedanceConfigured: boolean;
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
  onVideoStarted,
  zazzlePrintEnabled,
}: {
  card: AccountCard;
  onPhotoDeleted: () => void;
  onVideoStarted: () => void;
  zazzlePrintEnabled: boolean;
}) {
  const legacyCard = card.creditKind === "card";
  const cardRef = useRef<HTMLElement>(null);
  const cachedShareAsset = useRef<
    Awaited<ReturnType<typeof createShareAsset>> | null
  >(null);
  const pendingShareAsset = useRef<ReturnType<typeof createShareAsset> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function prepareShareAsset() {
    if (cachedShareAsset.current) return Promise.resolve(cachedShareAsset.current);
    if (pendingShareAsset.current) return pendingShareAsset.current;
    if (!cardRef.current) return Promise.reject(new Error("Card is not ready"));

    const pending = createShareAsset(cardRef.current)
      .then((asset) => {
        cachedShareAsset.current = asset;
        return asset;
      })
      .finally(() => {
        pendingShareAsset.current = null;
      });
    pendingShareAsset.current = pending;
    return pending;
  }

  async function download() {
    if (!cardRef.current) return;
    setBusy(true);
    setMessage(null);
    try {
      const asset = await prepareShareAsset();
      downloadShareAsset(asset, `${card.petName || "rarely"}-card.png`);
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
      const asset = await prepareShareAsset();
      if (canUseNativeFileShare(asset.file)) {
        await navigator.share({
          files: [asset.file],
          title: `${card.petName || "My pet"}'s Rarely card`,
        });
      } else {
        downloadShareAsset(asset, `${card.petName || "rarely"}-card.png`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("The card could not be shared. Try downloading it instead.");
    } finally {
      setBusy(false);
    }
  }

  async function shareVideo() {
    if (!card.videoUrl) return;
    setBusy(true);
    setMessage(null);
    let objectUrl: string | null = null;
    try {
      const response = await fetch(card.videoUrl);
      if (!response.ok) throw new Error("video_download_failed");
      const blob = await response.blob();
      const file = new File([blob], `${card.petName || "rarely"}-video.mp4`, {
        type: "video/mp4",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${card.petName || "My pet"}'s Rarely video`,
        });
      } else {
        objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = file.name;
        anchor.click();
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessage("The video could not be shared. Try again.");
      }
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBusy(false);
    }
  }

  async function startVideo() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/analyses/${card.id}/video`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "The video could not start.");
      }
      setMessage("Your talking-pet video is processing.");
      onVideoStarted();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The video could not start.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function orderPrint() {
    if (!cardRef.current || !zazzlePrintEnabled) return;
    setBusy(true);
    setMessage(null);
    try {
      const asset = await prepareShareAsset();
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
    if (!window.confirm("Delete this saved photo and its pet video? The text result will remain.")) return;
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
    <article
      className="min-w-0"
      onPointerEnter={() => legacyCard && void prepareShareAsset().catch(() => undefined)}
      onFocusCapture={() => legacyCard && void prepareShareAsset().catch(() => undefined)}
    >
      {legacyCard && <div className="grid min-h-[520px] place-items-center">
        {card.photoUrl && card.result ? (
          <ShareCard ref={cardRef} photo={card.photoUrl} result={card.result} />
        ) : (
          <div className="flex aspect-[9/16] w-[292px] flex-col items-center justify-center rounded-[22px] border-4 border-ink bg-purple p-6 text-center shadow-[7px_8px_0_#241a44]">
            <span className="font-mono text-[9px]">PHOTO DELETED</span>
            <strong className="my-3 font-display text-2xl font-normal">{card.result?.cardTitle || card.petName || "Saved card"}</strong>
            <p>Generation saved.</p>
          </div>
        )}
      </div>}
      {card.videoUrl && (
        <div className={`relative mx-auto mt-3 rounded-2xl border-[3px] border-ink bg-purple shadow-[4px_4px_0_#f4458f] ${legacyCard ? "w-36" : "mt-0 w-[min(292px,calc(100vw-4rem))]"}`}>
          <video className="block aspect-[9/16] w-full rounded-xl object-cover" src={card.videoUrl} controls playsInline preload="metadata" />
          <span className="absolute bottom-1 right-1 rounded border border-ink bg-yellow px-1 py-0.5 font-mono text-[6px] font-bold text-ink">TALKING-PET VIDEO</span>
        </div>
      )}
      {!legacyCard && !card.videoUrl && card.photoUrl && (
        <div className="relative mx-auto w-[min(292px,calc(100vw-4rem))] rounded-2xl border-[3px] border-ink bg-purple shadow-[4px_4px_0_#f4458f]">
          {/* Signed account media is intentionally rendered directly. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="block aspect-[9/16] w-full rounded-xl object-cover" src={card.photoUrl} alt={card.petName ? `${card.petName}'s selected photo` : "Selected pet"} />
          <span className="absolute bottom-1 right-1 rounded border border-ink bg-yellow px-1 py-0.5 font-mono text-[6px] font-bold text-ink">{card.videoStatus === "failed" ? "VIDEO DID NOT FINISH" : "VIDEO PREVIEW"}</span>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 max-sm:mx-auto max-sm:max-w-[310px]">
        <div className="mr-auto grid">
          <strong>{card.petName || "Your pet"}</strong>
          <span className="font-mono text-[9px] uppercase text-ink-muted">{date(card.completedAt)}</span>
        </div>
        {legacyCard && card.photoUrl && card.result && (
          <>
            <button className="min-h-9 rounded-lg border-2 border-ink bg-pink px-3 font-mono text-[9px] font-bold text-white shadow-[3px_3px_0_#241a44]" type="button" disabled={busy} onClick={() => void download()}>
              Download
            </button>
            <button
              className="min-h-9 rounded-lg border-2 border-ink bg-pink px-3 font-mono text-[9px] font-bold text-white shadow-[3px_3px_0_#241a44]"
              type="button"
              disabled={busy}
              onClick={() => void share()}
            >
              Share
            </button>
            {zazzlePrintEnabled && (
              <button className="min-h-9 rounded-lg border-2 border-ink bg-pink px-3 font-mono text-[9px] font-bold text-white shadow-[3px_3px_0_#241a44]" type="button" disabled={busy} onClick={() => void orderPrint()}>
                Order print
              </button>
            )}
            <button className="min-h-9 rounded-lg border-2 border-ink bg-cream px-3 font-mono text-[9px] font-bold text-ink shadow-[3px_3px_0_#241a44]" type="button" disabled={busy} onClick={() => void deletePhoto()}>
              Delete photo
            </button>
          </>
        )}
        {card.videoUrl && (
          <button className="min-h-9 rounded-lg border-2 border-ink bg-pink px-3 font-mono text-[9px] font-bold text-white shadow-[3px_3px_0_#241a44]" type="button" disabled={busy} onClick={() => void shareVideo()}>
            Share video
          </button>
        )}
        {!legacyCard && card.photoUrl && (
          <button className="min-h-9 rounded-lg border-2 border-ink bg-cream px-3 font-mono text-[9px] font-bold text-ink shadow-[3px_3px_0_#241a44]" type="button" disabled={busy} onClick={() => void deletePhoto()}>
            Delete photo & video
          </button>
        )}
        {card.videoEligible && (
          <button className="min-h-9 rounded-lg border-2 border-ink bg-pink px-3 font-mono text-[9px] font-bold text-white shadow-[3px_3px_0_#241a44]" type="button" disabled={busy} onClick={() => void startVideo()}>
            Finish my talking video
          </button>
        )}
        {card.videoStatus === "running" || card.videoStatus === "submitting" ? (
          <span className="w-full font-mono text-[9px] uppercase text-ink-muted">Pet video processing</span>
        ) : null}
      </div>
      {message && <p className="mt-3 text-xs font-extrabold text-[#a51c55]" role="alert">{message}</p>}
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
    <li className="grid items-center gap-5 rounded-xl border-[3px] border-ink bg-white p-5 sm:grid-cols-[1fr_auto] lg:grid-cols-[minmax(170px,0.7fr)_minmax(220px,1.3fr)_auto]">
      <div className="grid gap-0.5">
        <strong>
          {purchase.creditsGranted} {purchase.creditKind === "talking_video" ? "videos" : "legacy card credits"}
        </strong>
        <span className="font-mono text-[9px] uppercase text-ink-muted">
          {date(purchase.purchasedAt || purchase.createdAt)} ·{" "}
          {purchase.paymentProvider === "google_play"
            ? "Google Play"
            : purchase.paymentProvider === "lemon_squeezy"
              ? "Lemon Squeezy"
              : "Paddle"}
        </span>
      </div>
      <div className="grid gap-0.5 sm:text-right lg:text-right">
        <strong>{money(purchase.amountCents, purchase.currency)}</strong>
        <span className="font-mono text-[9px] uppercase text-ink-muted">{purchase.creditsRemaining} unused · {purchase.status.replace("_", " ")}</span>
      </div>
      {refundable && (
        <button className="min-h-10 rounded-lg border-2 border-ink bg-pink px-3 font-mono text-[9px] font-bold text-white shadow-[3px_3px_0_#241a44]" type="button" disabled={busy} onClick={() => void requestRefund()}>
          {busy
            ? "Requesting…"
            : purchase.status === "refund_pending"
              ? "Retry refund"
              : "Request full refund"}
        </button>
      )}
      {message && <p className="mt-3 text-xs font-extrabold text-[#a51c55]" role="status">{message}</p>}
    </li>
  );
}

export function AccountDashboard({
  paddleConfigured,
  googlePlayConfigured,
  seedanceConfigured,
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

  useEffect(() => {
    const videoRunning = account?.cards.some(
      (card) => card.videoStatus === "submitting" || card.videoStatus === "running",
    );
    if (!videoRunning) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [account?.cards, refresh]);

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
        setMessage("Three new talking-pet videos are ready.");
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
        setMessage("Payment complete. Adding three video credits…");
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
    if (!window.confirm(`Delete the saved photo and pet video for ${card.petName || "this attempt"}?`)) {
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
    return <main className="grid min-h-svh place-items-center bg-cream font-display text-xl text-ink">Loading account…</main>;
  }

  const checkoutAvailable =
    seedanceConfigured &&
    ((paymentChannel === "google_play" && googlePlayConfigured) ||
      (paymentChannel === "web" && paddleConfigured));
  const primaryProvider =
    paymentChannel === "google_play"
      ? ("google_play" as const)
      : ("paddle" as const);
  const checkoutPrice =
    paymentChannel === "google_play" ? playPrice : paymentChannel === "web" ? "$10" : null;
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
    <main className="min-h-svh bg-cream pt-7 text-ink">
      <header className="mx-auto grid min-h-20 w-[calc(100%-2.5rem)] max-w-[1180px] grid-cols-[auto_1fr] items-center gap-7 rounded-2xl border-[3px] border-ink bg-cream/95 px-5 py-3 shadow-[6px_7px_0_#241a44] max-sm:w-[calc(100%-1.75rem)] max-sm:gap-3 max-sm:px-3">
        <Link className="font-display text-2xl leading-none text-pink [text-shadow:2px_2px_0_#ffe36e]" href="/">RARELY <span className="text-yellow">★</span></Link>
        <nav className="flex flex-wrap items-center justify-end gap-5 font-mono text-[10px] font-medium uppercase text-ink-muted">
          <Link href="/">Make my pet talk</Link>
          <button className="border-0 bg-transparent p-0 font-bold uppercase text-pink" type="button" onClick={() => void signOut()}>Sign out</button>
        </nav>
      </header>

      <section className="mx-auto grid w-[calc(100%-2.5rem)] max-w-6xl items-center gap-14 py-14 lg:grid-cols-[1fr_350px] max-sm:w-[calc(100%-1.75rem)]">
        <div>
          <h1 className="mb-3 font-display text-[clamp(2.375rem,5vw,3.625rem)] font-normal leading-none tracking-tight">Account</h1>
          <p className="font-mono text-[11px] text-ink-muted">{account?.email}</p>
        </div>
        <aside className="mx-auto w-full max-w-[420px] rotate-1 rounded-[20px] border-4 border-ink bg-yellow p-6 shadow-[8px_9px_0_#241a44,14px_15px_0_#f4458f]">
          <span className="font-mono text-[10px] font-bold">VIDEO CREDITS</span>
          <strong className="block font-display text-8xl font-normal leading-none">{account?.creditBalance ?? 0}</strong>
          <p className="mb-5 text-xs font-extrabold leading-snug">Each finished talking-pet reel uses one credit. Rejected photos and technical failures return it.</p>
          {(account?.legacyCardCreditBalance ?? 0) > 0 && (
            <p className="mb-5 text-xs font-extrabold leading-snug">
              {account?.legacyCardCreditBalance} legacy card credits remain.{" "}
              <Link href="/?legacy=card">Use a legacy card credit</Link>
            </p>
          )}
          <button
            className="min-h-10 w-full rounded-lg border-2 border-ink bg-pink px-3 font-mono text-[9px] font-bold text-white shadow-[3px_3px_0_#241a44]"
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
                    : `Buy 3 videos${checkoutPrice ? ` — ${checkoutPrice}` : ""}`}
          </button>
          {paymentChannel === "play_unavailable" && (
            <p className="mt-4 text-xs font-extrabold leading-snug">Update Chrome or reopen Rarely from Google Play to buy credits.</p>
          )}
          {!seedanceConfigured && (
            <p className="mt-4 text-xs font-extrabold leading-snug">Talking-pet video checkout is temporarily unavailable.</p>
          )}
        </aside>
      </section>

      {message && <p className="mx-auto mb-8 w-[calc(100%-2.5rem)] max-w-6xl rounded-xl border-2 border-ink bg-[#bdeef5] px-5 py-3 text-center font-extrabold" role="status">{message}</p>}

      {inProgress.length > 0 && (
        <section className="mx-auto w-[calc(100%-2.5rem)] max-w-6xl border-t-[3px] border-ink py-16 max-sm:w-[calc(100%-1.75rem)]">
          <div className="mb-8 flex items-baseline gap-3">
            <h2 className="font-display text-[clamp(1.75rem,4vw,2.625rem)] font-normal leading-none">In progress</h2>
            <span className="font-mono text-xs font-bold text-pink">{inProgress.length}</span>
          </div>
          <div className="grid gap-3">
            {inProgress.map((card) => (
              <article className="flex items-center justify-between gap-5 rounded-xl border-[3px] border-ink bg-white px-5 py-4 shadow-[4px_4px_0_#241a44]" key={card.id}>
                <div className="grid gap-0.5"><strong>{card.petName || "New video"}</strong><span className="font-mono text-[9px] uppercase text-ink-muted">{card.status.replace("_", " ")}</span></div>
                <button className="min-h-10 rounded-lg border-2 border-ink bg-pink px-3 font-mono text-[9px] font-bold text-white shadow-[3px_3px_0_#241a44]" type="button" onClick={() => continueCard(card.id)}>Continue →</button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-6xl border-t-[3px] border-ink py-16 max-sm:w-[calc(100%-1.75rem)]">
        <div className="mb-8 flex items-baseline gap-3">
          <h2 className="font-display text-[clamp(1.75rem,4vw,2.625rem)] font-normal leading-none">My generations</h2>
          <span className="font-mono text-xs font-bold text-pink">{completedCards.length}</span>
        </div>
        {completedCards.length > 0 ? (
          <div className="grid items-start gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {completedCards.map((card) => (
              <SavedCard
                card={card}
                key={card.id}
                onPhotoDeleted={() => void refresh()}
                onVideoStarted={() => void refresh()}
                zazzlePrintEnabled={zazzlePrintEnabled}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-[3px] border-dashed border-ink bg-white/70 p-11 text-center">
            <strong className="block font-display text-2xl font-normal">No generations yet.</strong>
            <Link className="font-black text-pink" href="/">Make my pet talk</Link>
          </div>
        )}
      </section>

      {spentAttempts.length > 0 && (
        <section className="mx-auto w-[calc(100%-2.5rem)] max-w-6xl border-t-[3px] border-ink py-16 max-sm:w-[calc(100%-1.75rem)]">
          <div className="mb-8 flex items-baseline gap-3">
            <h2 className="font-display text-[clamp(1.75rem,4vw,2.625rem)] font-normal leading-none">Other attempts</h2>
            <span className="font-mono text-xs font-bold text-pink">{spentAttempts.length}</span>
          </div>
          <ul className="grid list-none gap-3 p-0">
            {spentAttempts.map((card) => (
              <li className="grid items-center gap-5 rounded-xl border-[3px] border-ink bg-white p-5 sm:grid-cols-[minmax(170px,0.7fr)_minmax(220px,1.3fr)_auto]" key={card.id}>
                <strong>{card.petName || "Photo attempt"}</strong>
                <span className="text-[13px] font-bold text-ink-muted">
                  {card.status === "photo_rejected"
                    ? card.rejectionMessage || "The AI could not use this photo. Your credit was returned."
                    : "A technical failure occurred. The reserved credit was returned."}
                </span>
                {card.photoUrl && (
                  <button
                    className="min-h-10 rounded-lg border-2 border-ink bg-pink px-3 font-mono text-[9px] font-bold text-white shadow-[3px_3px_0_#241a44]"
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

      <section className="mx-auto w-[calc(100%-2.5rem)] max-w-6xl border-t-[3px] border-ink py-16 max-sm:w-[calc(100%-1.75rem)]">
        <div className="mb-8 flex items-baseline gap-3">
          <h2 className="font-display text-[clamp(1.75rem,4vw,2.625rem)] font-normal leading-none">Purchases</h2>
          <span className="font-mono text-xs font-bold text-pink">{account?.purchases.length ?? 0}</span>
        </div>
        {account?.purchases.length ? (
          <ul className="grid list-none gap-3 p-0">
            {account.purchases.map((purchase) => (
              <PurchaseRow purchase={purchase} key={purchase.id} onRefunded={() => void refresh()} />
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border-[3px] border-dashed border-ink bg-white/70 p-11 text-center"><p className="font-bold text-ink-muted">No purchases yet.</p></div>
        )}
      </section>

      <PublicFooter />
    </main>
  );
}
