import { describe, expect, it } from "vitest";
import {
  googlePlayMoneyToCents,
  validateGooglePlayPurchase,
} from "@/lib/payments/google-play-validation";

describe("Google Play purchase validation", () => {
  const validPurchase = {
    orderId: "GPA.1234-5678-9012-34567",
    purchaseCompletionTime: "2026-07-24T10:00:00Z",
    purchaseStateContext: { purchaseState: "PURCHASED" },
    productLineItem: [
      {
        productId: "five_card_credits",
        productOfferDetails: {
          quantity: 1,
          consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
        },
      },
    ],
  };

  it("accepts one purchased five-credit product", () => {
    expect(
      validateGooglePlayPurchase(validPurchase, "five_card_credits"),
    ).toEqual({
      orderId: validPurchase.orderId,
      productId: "five_card_credits",
      purchasedAt: validPurchase.purchaseCompletionTime,
      consumed: false,
    });
  });

  it.each([
    ["PENDING", "five_card_credits", 1],
    ["CANCELLED", "five_card_credits", 1],
    ["PURCHASED", "another_product", 1],
    ["PURCHASED", "five_card_credits", 2],
  ])("rejects invalid state, product, or quantity", (state, productId, quantity) => {
    expect(() =>
      validateGooglePlayPurchase(
        {
          ...validPurchase,
          purchaseStateContext: { purchaseState: state },
          productLineItem: [
            {
              productId,
              productOfferDetails: { quantity },
            },
          ],
        },
        "five_card_credits",
      ),
    ).toThrow("google_play_purchase_invalid");
  });

  it("converts Play Money units and nanos to cents", () => {
    expect(
      googlePlayMoneyToCents({
        currencyCode: "usd",
        units: "4",
        nanos: 990_000_000,
      }),
    ).toEqual({ amountCents: 499, currency: "USD" });
  });

  it("rejects malformed money", () => {
    expect(
      googlePlayMoneyToCents({ currencyCode: "USD", units: "not-a-number" }),
    ).toBeNull();
  });
});
