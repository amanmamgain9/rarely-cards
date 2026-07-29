"use client";

import { useEffect } from "react";
import { PADDLE_CHECKOUT_COMPLETED_EVENT } from "@/lib/payments/paddle-client-events";

export function PaddleDefaultCheckout({
  token,
  environment,
}: {
  token: string | null;
  environment: "sandbox" | "production";
}) {
  useEffect(() => {
    const transactionId = new URLSearchParams(window.location.search).get("_ptxn");
    if (!token || !transactionId) return;
    void import("@paddle/paddle-js").then(({ initializePaddle }) =>
      initializePaddle({
        token,
        environment,
        eventCallback: (event) => {
          if (event.name === "checkout.completed") {
            window.dispatchEvent(
              new CustomEvent(PADDLE_CHECKOUT_COMPLETED_EVENT, {
                detail: { transactionId },
              }),
            );
            const url = new URL(window.location.href);
            url.searchParams.delete("_ptxn");
            window.history.replaceState(
              null,
              "",
              `${url.pathname}${url.search}${url.hash}`,
            );
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
      }),
    );
  }, [environment, token]);

  return null;
}
