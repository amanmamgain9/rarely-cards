import { describe, expect, it } from "vitest";
import type { PublicAnalysis } from "@/lib/analysis/types";
import { flowForWorkflow } from "@/components/rarity/rarity-model";

function analysis(status: PublicAnalysis["status"]): PublicAnalysis {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    petName: null,
    petPronouns: null,
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
    draftData: {},
  };
}

describe("workflow view", () => {
  it("keeps pre-payment video drafts in the line workspace", () => {
    const video = {
      ...analysis("awaiting_payment"),
      selectedDialogue: "I definitely did not eat that.",
    };
    expect(
      flowForWorkflow(
        { creditBalance: 0, analysis: video },
        "naming",
      ),
    ).toBe("naming");
    expect(
      flowForWorkflow(
        { creditBalance: 3, analysis: video },
        "naming",
      ),
    ).toBe("naming");
  });

  it("opens legacy card states in the line workspace", () => {
    expect(
      flowForWorkflow(
        { creditBalance: 2, analysis: analysis("completed") },
        "idle",
      ),
    ).toBe("naming");
  });
});
