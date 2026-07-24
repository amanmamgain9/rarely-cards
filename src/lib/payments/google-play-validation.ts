export type GooglePlayProductPurchase = {
  productLineItem?: Array<{
    productId?: string;
    productOfferDetails?: {
      quantity?: number;
      consumptionState?: string;
    };
  }>;
  purchaseStateContext?: { purchaseState?: string };
  orderId?: string;
  purchaseCompletionTime?: string;
  acknowledgementState?: string;
};

export type GooglePlayMoney = {
  currencyCode?: string;
  units?: string;
  nanos?: number;
};

export function googlePlayMoneyToCents(money: GooglePlayMoney | undefined) {
  if (!money?.currencyCode) return null;
  const units = Number(money.units ?? "0");
  const nanos = Number(money.nanos ?? 0);
  if (!Number.isSafeInteger(units) || !Number.isSafeInteger(nanos)) return null;
  const cents = Math.round(units * 100 + nanos / 10_000_000);
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return { amountCents: cents, currency: money.currencyCode.toUpperCase() };
}

export function validateGooglePlayPurchase(
  purchase: GooglePlayProductPurchase,
  expectedProductId: string,
) {
  const lineItems = purchase.productLineItem ?? [];
  if (
    purchase.purchaseStateContext?.purchaseState !== "PURCHASED" ||
    !purchase.orderId ||
    lineItems.length !== 1 ||
    lineItems[0]?.productId !== expectedProductId ||
    (lineItems[0]?.productOfferDetails?.quantity ?? 1) !== 1
  ) {
    throw new Error("google_play_purchase_invalid");
  }
  return {
    orderId: purchase.orderId,
    productId: expectedProductId,
    purchasedAt: purchase.purchaseCompletionTime ?? null,
    consumed:
      lineItems[0]?.productOfferDetails?.consumptionState ===
      "CONSUMPTION_STATE_CONSUMED",
  };
}
