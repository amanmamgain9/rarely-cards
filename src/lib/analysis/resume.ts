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

export const DRAFT_ANALYSIS_STATUSES = [
  "awaiting_payment",
  "payment_pending",
  "awaiting_name",
] as const satisfies readonly AnalysisStatus[];

export function isResumableAnalysisStatus(status: AnalysisStatus) {
  return RESUMABLE_ANALYSIS_STATUSES.some((candidate) => candidate === status);
}

export function isDraftAnalysisStatus(status: AnalysisStatus) {
  return DRAFT_ANALYSIS_STATUSES.some((candidate) => candidate === status);
}
