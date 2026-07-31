import { describe, expect, it } from "vitest";
import { buildPetVideoPrompt } from "@/lib/video/prompt";

describe("buildPetVideoPrompt", () => {
  it("grounds motion and identity in the completed card", () => {
    const prompt = buildPetVideoPrompt({
      status: "accepted",
      petName: "Miso",
      species: "cat",
      energy: "curious",
      cardTitle: "Window Watch",
      rarityScore: 96,
      signatureRead: {
        title: "Something Moved",
        score: 98,
        thought: "I saw that leaf move and I need everyone to remain calm.",
      },
      ratings: [
        { key: "a", label: "A", score: 90, phrase: "A", reason: "A" },
        { key: "b", label: "B", score: 90, phrase: "B", reason: "B" },
        { key: "c", label: "C", score: 90, phrase: "C", reason: "C" },
        { key: "d", label: "D", score: 90, phrase: "D", reason: "D" },
      ],
    }, "I knew that snack was for me.");

    expect(prompt).toContain("exact cat");
    expect(prompt).toContain("subtle head tilt");
    expect(prompt).toContain("preserve the exact identity");
    expect(prompt).toContain("I knew that snack was for me.");
    expect(prompt).toContain("Synchronize the mouth");
  });
});
