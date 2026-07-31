"use client";

const PLAY_BILLING_METHOD = "https://play.google.com/billing";
export const GOOGLE_PLAY_PRODUCT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "three_talking_pet_videos";

type PlayProduct = {
  itemId: string;
  title: string;
  description: string;
  price: { currency: string; value: string };
  formattedPrice: string;
};

async function getService() {
  if (typeof window.getDigitalGoodsService !== "function") {
    throw new Error("Google Play Billing is unavailable. Update Chrome and try again.");
  }
  return window.getDigitalGoodsService(PLAY_BILLING_METHOD);
}

function formatPrice(currency: string, value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount);
}

export async function getGooglePlayProduct(): Promise<PlayProduct> {
  const service = await getService();
  const [detail] = await service.getDetails([GOOGLE_PLAY_PRODUCT_ID]);
  if (!detail || detail.itemId !== GOOGLE_PLAY_PRODUCT_ID) {
    throw new Error("The three-video pack is unavailable in Google Play.");
  }
  return {
    ...detail,
    formattedPrice: formatPrice(detail.price.currency, detail.price.value),
  };
}

async function verifyPurchase(
  purchaseToken: string,
  productId: string,
  purchaseId?: string,
  analysisId?: string,
) {
  const response = await fetch("/api/checkout/google-play/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purchaseToken,
      purchaseId,
      analysisId,
      productId,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Google Play purchase could not be verified.");
  }
  return payload as { purchaseId: string; analysisId: string | null };
}

export async function startGooglePlayPurchase(input: {
  purchaseId: string;
  analysisId?: string;
}) {
  const product = await getGooglePlayProduct();
  const request = new PaymentRequest(
    [
      {
        supportedMethods: PLAY_BILLING_METHOD,
        data: { sku: product.itemId },
      },
    ],
    {
      total: {
        label: product.title || "Rarely three talking-pet videos",
        amount: {
          currency: product.price.currency,
          value: product.price.value,
        },
      },
    },
  );

  const payment = await request.show();
  const details = payment.details as {
    purchaseToken?: string;
    token?: string;
  };
  const purchaseToken = details.purchaseToken ?? details.token;
  if (!purchaseToken) {
    await payment.complete("fail");
    throw new Error("Google Play did not return a purchase token.");
  }

  try {
    const result = await verifyPurchase(
      purchaseToken,
      GOOGLE_PLAY_PRODUCT_ID,
      input.purchaseId,
      input.analysisId,
    );
    await payment.complete("success");
    return result;
  } catch (error) {
    await payment.complete("fail");
    throw error;
  }
}

export async function restoreGooglePlayPurchases(analysisId?: string) {
  const service = await getService();
  const purchases = await service.listPurchases();
  const restored: { purchaseId: string; analysisId: string | null }[] = [];
  for (const purchase of purchases) {
    try {
      restored.push(await verifyPurchase(
        purchase.purchaseToken,
        purchase.itemId,
        undefined,
        analysisId,
      ));
    } catch {
      // Play can retain unrelated or retired one-time items. Verification is
      // catalog-authoritative per item, so one unknown SKU must not prevent
      // current or historical Rarely purchases from being restored.
    }
  }
  return restored;
}
