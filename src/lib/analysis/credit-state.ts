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
  | "refund_failed"
  | "disputed"
  | null;

export function purchaseAdjustmentDecision(input: {
  action: string;
  status: string;
}): PurchaseAdjustmentDecision {
  if (["chargeback", "chargeback_warning"].includes(input.action)) {
    return "disputed";
  }
  if (input.action !== "refund") return null;
  if (input.status === "approved") return "refunded";
  if (input.status === "pending_approval") return "refund_pending";
  if (["rejected", "reversed"].includes(input.status)) return "refund_failed";
  return null;
}
