import { describe, expect, it } from "vitest";
import type { PublicAnalysis } from "@/lib/analysis/types";
import { flowForWorkflow } from "@/components/rarity/rarity-model";

function analysis(status: PublicAnalysis["status"]): PublicAnalysis {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    petName: null,
    cardStyle: "pet",
    experienceKind: "talking_video",
    status,
    result: null,
    rejectionMessage: null,
    replacementCount: 0,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    photoUrl: "/photo.jpg",
    refundState: "none",
    dialogueSuggestions: [],
    selectedDialogue: null,
  };
}

describe("workflow view", () => {
  it("shows checkout only when a waiting analysis has no credits", () => {
    const video = {
      ...analysis("awaiting_payment"),
      selectedDialogue: "I definitely did not eat that.",
    };
    expect(
      flowForWorkflow(
        { creditBalance: 0, legacyCardCreditBalance: 0, analysis: video },
        "checkout",
      ),
    ).toBe("checkout");
    expect(
      flowForWorkflow(
        { creditBalance: 3, legacyCardCreditBalance: 0, analysis: video },
        "checkout",
      ),
    ).toBe("naming");
  });

  it("keeps checkout visible while a zero-credit workflow snapshot catches up", () => {
    expect(
      flowForWorkflow(
        {
          creditBalance: 0,
          legacyCardCreditBalance: 0,
          analysis: analysis("awaiting_name"),
        },
        "checkout",
      ),
    ).toBe("checkout");
  });

  it("does not resume a legacy analysis with unrelated video credits", () => {
    const legacy = {
      ...analysis("awaiting_payment"),
      experienceKind: "card" as const,
    };
    expect(
      flowForWorkflow(
        { creditBalance: 3, legacyCardCreditBalance: 0, analysis: legacy },
        "checkout",
      ),
    ).toBe("checkout");
    expect(
      flowForWorkflow(
        { creditBalance: 0, legacyCardCreditBalance: 5, analysis: legacy },
        "checkout",
      ),
    ).toBe("naming");
  });

  it("keeps the local confirmation screen until the server advances", () => {
    expect(
      flowForWorkflow(
        { creditBalance: 0, legacyCardCreditBalance: 0, analysis: analysis("awaiting_payment") },
        "verifying",
      ),
    ).toBe("verifying");
  });

  it("lets terminal server state replace transient processing state", () => {
    expect(
      flowForWorkflow(
        { creditBalance: 2, legacyCardCreditBalance: 0, analysis: analysis("completed") },
        "processing",
      ),
    ).toBe("completed");
  });
});
