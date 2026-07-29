export type CreditOutcome = "consume" | "restore" | "none";

export function creditOutcomeForEvent(
  event: "accepted_response" | "rejected_response" | "technical_failure" | "invalid_upload",
): CreditOutcome {
  if (event === "accepted_response" || event === "rejected_response") {
    return "consume";
  }
  if (event === "technical_failure") return "restore";
  return "none";
}

export type PurchaseAdjustmentDecision =
  | "refund_pending"
  | "refunded"
  | "refund_rejected"
  | "refund_reversed"
  | "disputed"
  | "dispute_reversed"
  | null;

export function purchaseAdjustmentDecision(input: {
  action: string;
  status: string;
}): PurchaseAdjustmentDecision {
  if (
    ["chargeback_reverse", "chargeback_warning_reverse"].includes(input.action)
  ) {
    return "dispute_reversed";
  }
  if (["chargeback", "chargeback_warning"].includes(input.action)) {
    return input.status === "reversed" ? "dispute_reversed" : "disputed";
  }
  if (input.action !== "refund") return null;
  if (input.status === "approved") return "refunded";
  if (input.status === "pending_approval") return "refund_pending";
  if (input.status === "rejected") return "refund_rejected";
  if (input.status === "reversed") return "refund_reversed";
  return null;
}
