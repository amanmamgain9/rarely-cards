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
    return <p>One payment adds five AI pet-card credits to your account.</p>;
  }
  if (channel === "play_unavailable") {
    return (
      <p>
        Google Play Billing is unavailable. Update Chrome or reopen Rarely from
        Google Play before purchasing credits.
      </p>
    );
  }

  const shownPrice = channel === "google_play" ? price : "$5";
  return (
    <>
      <p>
        One {shownPrice ? `${shownPrice} ` : ""}pack adds five AI pet-card
        credits to your account. Use them now or later, buy another pack
        whenever you want, and never worry about a subscription.
      </p>
      <Link className="pricing-primary-cta" href="/#maker">
        Get 5 card credits{shownPrice ? ` — ${shownPrice}` : ""} <span>→</span>
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
      <div className="ticket-price">
        <span>$</span>
        <strong>5</strong>
        <small>USD</small>
      </div>
    );
  }
  return (
    <div className="ticket-price">
      <strong>{channel === "google_play" ? price || "…" : "…"}</strong>
    </div>
  );
}

export function PaymentProcessorCopy() {
  const channel = usePaymentChannel();
  if (channel === "web") {
    return (
      <p>
        Lemon Squeezy or Paddle securely processes the one-time web payment.
        Your selected provider handles payment details, applicable sales tax or
        VAT, and your receipt.
      </p>
    );
  }
  if (channel === "google_play") {
    return (
      <p>
        Google Play securely processes the one-time in-app purchase and shows
        your local price and applicable tax before you confirm.
      </p>
    );
  }
  return (
    <p>
      The available secure payment provider and final price are shown before
      you confirm a purchase.
    </p>
  );
}
