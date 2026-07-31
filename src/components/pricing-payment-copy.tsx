"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGooglePlayProduct } from "@/lib/payments/google-play-client";
import { usePaymentChannel } from "@/lib/payments/use-payment-channel";

export function PricingIntroPaymentCopy() {
  const channel = usePaymentChannel();
  const [price, setPrice] = useState<string | null>(null);

  useEffect(() => {
    if (channel !== "google_play") return;
    void getGooglePlayProduct()
      .then((product) => setPrice(product.formattedPrice))
      .catch(() => setPrice(null));
  }, [channel]);

  if (channel === "loading") {
    return <p className="mb-7 max-w-xl text-lg font-bold leading-relaxed text-ink-muted">One payment adds three talking-pet video credits to your account.</p>;
  }
  if (channel === "play_unavailable") {
    return (
      <p className="mb-7 max-w-xl text-lg font-bold leading-relaxed text-ink-muted">
        Google Play Billing is unavailable. Update Chrome or reopen Rarely from
        Google Play before purchasing credits.
      </p>
    );
  }

  const shownPrice = channel === "google_play" ? price : "$10";
  return (
    <>
      <p className="mb-7 max-w-xl text-lg font-bold leading-relaxed text-ink-muted">
        One {shownPrice ? `${shownPrice} ` : ""}pack adds three talking-pet
        video credits to your account. Use them now or later, buy another pack
        whenever you want, and never worry about a subscription.
      </p>
      <Link className="inline-flex min-h-14 items-center gap-5 rounded-2xl border-[3px] border-ink bg-pink px-6 font-mono text-xs font-bold uppercase text-white shadow-[6px_7px_0_#241a44] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_4px_0_#241a44]" href="/#maker">
        Get 3 videos{shownPrice ? ` — ${shownPrice}` : ""} <span>→</span>
      </Link>
    </>
  );
}

export function PricingTicketPrice() {
  const channel = usePaymentChannel();
  const [price, setPrice] = useState<string | null>(null);

  useEffect(() => {
    if (channel !== "google_play") return;
    void getGooglePlayProduct()
      .then((product) => setPrice(product.formattedPrice))
      .catch(() => setPrice(null));
  }, [channel]);

  if (channel === "web") {
    return (
      <div className="flex min-h-44 items-center justify-center font-display">
        <span className="self-start pt-10 text-3xl">$</span>
        <strong className="text-[9rem] font-normal leading-none tracking-[-0.1em]">10</strong>
        <small className="self-end pb-10 font-mono text-xs">USD</small>
      </div>
    );
  }
  return (
    <div className="flex min-h-44 items-center justify-center font-display">
      <strong className="text-7xl font-normal">{channel === "google_play" ? price || "…" : "…"}</strong>
    </div>
  );
}

export function PaymentProcessorCopy() {
  const channel = usePaymentChannel();
  if (channel === "web") {
    return (
      <p className="m-0 text-sm font-bold leading-relaxed text-ink-muted">
        Paddle securely processes the one-time web payment, including payment
        details, applicable sales tax or VAT, and your receipt.
      </p>
    );
  }
  if (channel === "google_play") {
    return (
      <p className="m-0 text-sm font-bold leading-relaxed text-ink-muted">
        Google Play securely processes the one-time in-app purchase and shows
        your local price and applicable tax before you confirm.
      </p>
    );
  }
  return (
    <p className="m-0 text-sm font-bold leading-relaxed text-ink-muted">
      The available secure payment provider and final price are shown before
      you confirm a purchase.
    </p>
  );
}
