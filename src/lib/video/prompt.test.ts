import { describe, expect, it } from "vitest";
import { buildPetVideoPrompt } from "@/lib/video/prompt";

describe("buildPetVideoPrompt", () => {
  it("grounds motion and identity in the supplied photo", () => {
    const prompt = buildPetVideoPrompt({
      petName: "Miso",
      dialogue: "I knew that snack was for me.",
      petPronouns: "she",
    });

    expect(prompt).toContain("exact pet");
    expect(prompt).toContain("subtle head movement");
    expect(prompt).toContain("preserve the exact identity");
    expect(prompt).toContain("I knew that snack was for me.");
    expect(prompt).toContain("Synchronize the mouth");
    expect(prompt).toContain("girl pet");
  });
});
