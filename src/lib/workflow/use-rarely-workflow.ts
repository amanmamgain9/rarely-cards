"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WorkflowSnapshot } from "@/lib/workflow/types";

function workflowKey(analysisId: string | null) {
  return ["rarely-workflow", analysisId ?? "account"] as const;
}

async function fetchWorkflow(analysisId: string | null) {
  const params = analysisId
    ? `?${new URLSearchParams({ analysisId })}`
    : "";
  const response = await fetch(`/api/workflow${params}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Workflow could not be loaded.");
  }
  return payload as WorkflowSnapshot;
}

export function useRarelyWorkflow(input: {
  userId: string | null;
  analysisId: string | null;
  initialSnapshot: WorkflowSnapshot;
}) {
  const queryClient = useQueryClient();
  const key = workflowKey(input.analysisId);
  const initialMatches =
    input.initialSnapshot.analysis?.id === input.analysisId ||
    (!input.initialSnapshot.analysis && !input.analysisId);
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchWorkflow(input.analysisId),
    enabled: Boolean(input.userId),
    initialData: initialMatches ? input.initialSnapshot : undefined,
  });

  useEffect(() => {
    if (!input.userId) return;
    const supabase = createClient();
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["rarely-workflow"] });
    };
    const channel = supabase
      .channel(`rarely-workflow:${input.userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "analysis_requests",
          filter: `user_id=eq.${input.userId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "credit_purchases",
          filter: `user_id=eq.${input.userId}`,
        },
        invalidate,
      )
      .subscribe((status) => {
        // Close the gap between the server render and this subscription.
        // Reconnects also recover any notification missed while offline.
        if (status === "SUBSCRIBED") invalidate();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [input.userId, queryClient]);

  return {
    snapshot:
      query.data ??
      (initialMatches
        ? input.initialSnapshot
        : { creditBalance: input.initialSnapshot.creditBalance, analysis: null }),
    refresh: query.refetch,
    setSnapshot: (snapshot: WorkflowSnapshot) =>
      queryClient.setQueryData(key, snapshot),
  };
}
