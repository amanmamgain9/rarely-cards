import { describe, expect, it } from "vitest";
import {
  creditOutcomeForEvent,
  purchaseAdjustmentDecision,
} from "@/lib/analysis/credit-state";

describe("five-card credit policy", () => {
  it("charges accepted and rejected AI responses", () => {
    expect(creditOutcomeForEvent("accepted_response")).toBe("consume");
    expect(creditOutcomeForEvent("rejected_response")).toBe("consume");
  });

  it("restores technical failures and ignores invalid uploads", () => {
    expect(creditOutcomeForEvent("technical_failure")).toBe("restore");
    expect(creditOutcomeForEvent("invalid_upload")).toBe("none");
  });

  it("maps purchase refund and dispute events", () => {
    expect(
      purchaseAdjustmentDecision({
        action: "refund",
        status: "pending_approval",
      }),
    ).toBe("refund_pending");
    expect(
      purchaseAdjustmentDecision({ action: "refund", status: "approved" }),
    ).toBe("refunded");
    expect(
      purchaseAdjustmentDecision({ action: "refund", status: "rejected" }),
    ).toBe("refund_failed");
    expect(
      purchaseAdjustmentDecision({ action: "chargeback", status: "approved" }),
    ).toBe("disputed");
    expect(
      purchaseAdjustmentDecision({ action: "credit", status: "approved" }),
    ).toBeNull();
  });
});
