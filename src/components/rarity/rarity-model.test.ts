import { describe, expect, it } from "vitest";
import type { PublicAnalysis } from "@/lib/analysis/types";
import { flowForWorkflow } from "@/components/rarity/rarity-model";

function analysis(status: PublicAnalysis["status"]): PublicAnalysis {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    cardStyle: "pet",
    status,
    result: null,
    rejectionMessage: null,
    replacementCount: 0,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    photoUrl: "/photo.jpg",
    refundState: "none",
  };
}

describe("workflow view", () => {
  it("shows checkout only when a waiting analysis has no credits", () => {
    expect(
      flowForWorkflow(
        { creditBalance: 0, analysis: analysis("awaiting_payment") },
        "checkout",
      ),
    ).toBe("checkout");
    expect(
      flowForWorkflow(
        { creditBalance: 3, analysis: analysis("awaiting_payment") },
        "checkout",
      ),
    ).toBe("naming");
  });

  it("keeps the local confirmation screen until the server advances", () => {
    expect(
      flowForWorkflow(
        { creditBalance: 0, analysis: analysis("awaiting_payment") },
        "verifying",
      ),
    ).toBe("verifying");
  });

  it("lets terminal server state replace transient processing state", () => {
    expect(
      flowForWorkflow(
        { creditBalance: 2, analysis: analysis("completed") },
        "processing",
      ),
    ).toBe("completed");
  });
});
