"use client";

import { initializePaddle } from "@paddle/paddle-js";
import { useEffect } from "react";

export function PaddleDefaultCheckout({
  token,
  environment,
}: {
  token: string | null;
  environment: "sandbox" | "production";
}) {
  useEffect(() => {
    if (!token || !new URLSearchParams(window.location.search).has("_ptxn")) return;
    void initializePaddle({
      token,
      environment,
      checkout: {
        settings: {
          displayMode: "overlay",
          theme: "light",
          showAddDiscounts: false,
        },
      },
    });
  }, [environment, token]);

  return null;
}
