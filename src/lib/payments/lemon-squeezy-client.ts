"use client";

export function openLemonSqueezyCheckout(
  checkoutUrl: string,
  onSuccess: () => void,
) {
  window.createLemonSqueezy?.();
  const lemon = window.LemonSqueezy;
  if (!lemon) {
    window.location.assign(checkoutUrl);
    return;
  }
  lemon.Setup({
    eventHandler: (event) => {
      if (event.event === "Checkout.Success") onSuccess();
    },
  });
  lemon.Url.Open(checkoutUrl);
}
