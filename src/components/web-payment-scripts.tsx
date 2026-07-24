"use client";

import Script from "next/script";
import { PaddleDefaultCheckout } from "@/components/paddle-default-checkout";
import { usePaymentChannel } from "@/lib/payments/use-payment-channel";

export function WebPaymentScripts({
  paddleToken,
  paddleEnvironment,
}: {
  paddleToken: string | null;
  paddleEnvironment: "sandbox" | "production";
}) {
  const channel = usePaymentChannel();
  if (channel !== "web") return null;

  return (
    <>
      <Script
        src="https://app.lemonsqueezy.com/js/lemon.js"
        strategy="afterInteractive"
      />
      <PaddleDefaultCheckout
        token={paddleToken}
        environment={paddleEnvironment}
      />
    </>
  );
}
