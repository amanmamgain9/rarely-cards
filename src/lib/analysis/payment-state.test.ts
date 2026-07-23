import { describe, expect, it } from "vitest";
import {
  adjustmentStatus,
  paymentCompletionDecision,
} from "@/lib/analysis/payment-state";

describe("paid analysis payment state", () => {
  it("applies a verified completion only to payment states", () => {
    expect(
      paymentCompletionDecision({
        status: "payment_pending",
        storedTransactionId: "txn_same",
        incomingTransactionId: "txn_same",
      }),
    ).toBe("apply");
  });

  it("treats an out-of-order duplicate completion as a no-op", () => {
    expect(
      paymentCompletionDecision({
        status: "completed",
        storedTransactionId: "txn_same",
        incomingTransactionId: "txn_same",
      }),
    ).toBe("noop");
    expect(
      paymentCompletionDecision({
        status: "awaiting_name",
        storedTransactionId: "txn_same",
        incomingTransactionId: "txn_same",
      }),
    ).toBe("noop");
  });

  it("rejects a different transaction for the same request", () => {
    expect(
      paymentCompletionDecision({
        status: "payment_pending",
        storedTransactionId: "txn_original",
        incomingTransactionId: "txn_other",
      }),
    ).toBe("reject");
  });

  it("maps refund and chargeback updates", () => {
    expect(adjustmentStatus({ action: "refund", status: "approved" })).toBe(
      "refunded",
    );
    expect(
      adjustmentStatus({ action: "refund", status: "pending_approval" }),
    ).toBe("refund_pending");
    expect(
      adjustmentStatus({ action: "chargeback", status: "approved" }),
    ).toBe("disputed");
  });
});

