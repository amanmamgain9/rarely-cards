"use client";

import { useSyncExternalStore } from "react";
import { HERO_CARD_DEMOS } from "@/components/rarity/rarity-model";

let index = 0;
let timer: number | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (
    timer === null &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    timer = window.setInterval(() => {
      index = (index + 1) % HERO_CARD_DEMOS.length;
      listeners.forEach((current) => current());
    }, 3_600);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

export function useHeroDemo() {
  return HERO_CARD_DEMOS[
    useSyncExternalStore(subscribe, () => index, () => 0)
  ];
}

