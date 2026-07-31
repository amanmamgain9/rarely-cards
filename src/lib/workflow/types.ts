import type { PublicAnalysis } from "@/lib/analysis/types";

export type WorkflowSnapshot = {
  creditBalance: number;
  legacyCardCreditBalance: number;
  analysis: PublicAnalysis | null;
};
