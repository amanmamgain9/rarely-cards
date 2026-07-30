import type { PublicAnalysis } from "@/lib/analysis/types";

export type WorkflowSnapshot = {
  creditBalance: number;
  analysis: PublicAnalysis | null;
};

