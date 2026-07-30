"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { GooglePlayPurchaseRestorer } from "@/components/rarity/workflow-effects";
import { usePaymentRuntime } from "@/lib/payments/use-payment-channel";
import { useRarelyWorkflow } from "@/lib/workflow/use-rarely-workflow";
import type { WorkflowSnapshot } from "@/lib/workflow/types";

type WorkflowContextValue = ReturnType<typeof useRarelyWorkflow> & {
  analysisId: string | null;
  setAnalysisId: Dispatch<SetStateAction<string | null>>;
};

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function RarelyWorkflowProvider({
  userId,
  initialSnapshot,
  children,
}: {
  userId: string | null;
  initialSnapshot: WorkflowSnapshot;
  children: ReactNode;
}) {
  const [analysisId, setAnalysisId] = useState(
    initialSnapshot.analysis?.id ?? null,
  );
  const workflow = useRarelyWorkflow({ userId, analysisId, initialSnapshot });
  const { channel } = usePaymentRuntime();
  const refreshWorkflow = workflow.refresh;
  const handlePurchaseRestored = useCallback(() => {
    void refreshWorkflow();
  }, [refreshWorkflow]);

  return (
    <WorkflowContext.Provider
      value={{ ...workflow, analysisId, setAnalysisId }}
    >
      <GooglePlayPurchaseRestorer
        channel={channel}
        enabled={Boolean(userId)}
        analysisId={analysisId}
        onRestored={handlePurchaseRestored}
      />
      {children}
    </WorkflowContext.Provider>
  );
}

export function useRarelyWorkflowContext() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useRarelyWorkflowContext must be used within RarelyWorkflowProvider");
  }
  return context;
}

