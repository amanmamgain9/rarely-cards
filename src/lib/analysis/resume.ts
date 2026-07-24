import type { AnalysisStatus } from "@/lib/analysis/types";

export const PENDING_PHOTO_COOKIE = "rarely-pending-photo";

export const RESUMABLE_ANALYSIS_STATUSES = [
  "awaiting_payment",
  "payment_pending",
  "awaiting_name",
  "paid",
  "processing",
  "refund_pending",
] as const satisfies readonly AnalysisStatus[];
