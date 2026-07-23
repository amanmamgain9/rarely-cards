import type { AnalysisStatus } from "@/lib/analysis/types";

export function paymentCompletionDecision({
  status,
  storedTransactionId,
  incomingTransactionId,
}: {
  status: AnalysisStatus;
  storedTransactionId: string | null;
  incomingTransactionId: string;
}): "apply" | "noop" | "reject" {
  if (
    storedTransactionId &&
    storedTransactionId !== incomingTransactionId
  ) {
    return "reject";
  }
  if (
    ["awaiting_name", "completed", "processing", "paid", "photo_rejected"].includes(
      status,
    )
  ) {
    return "noop";
  }
  return ["payment_pending", "awaiting_payment"].includes(status)
    ? "apply"
    : "reject";
}

export function adjustmentStatus({
  action,
  status,
}: {
  action: string;
  status: string;
}): AnalysisStatus | null {
  if (["chargeback", "chargeback_warning"].includes(action)) {
    return "disputed";
  }
  if (action !== "refund") return null;
  if (status === "approved") return "refunded";
  if (status === "pending_approval") return "refund_pending";
  if (["rejected", "reversed"].includes(status)) return "failed";
  return null;
}

