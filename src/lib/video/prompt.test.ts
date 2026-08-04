import { describe, expect, it } from "vitest";
import { buildPetVideoPrompt } from "@/lib/video/prompt";

describe("buildPetVideoPrompt", () => {
  it("grounds motion and identity in the supplied photo", () => {
    const prompt = buildPetVideoPrompt({
      petName: "Miso",
      dialogue: "I knew that snack was for me.",
      petPronouns: "she",
      voiceAccent: "english",
    });

    expect(prompt).toContain("exact pet");
    expect(prompt).toContain("subtle head movement");
    expect(prompt).toContain("preserve the exact identity");
    expect(prompt).toContain("I knew that snack was for me.");
    expect(prompt).toContain("Synchronize the mouth");
    expect(prompt).toContain("girl pet");
    expect(prompt).toContain("English accent");
  });

  it("directs a French accent without translating the line", () => {
    const prompt = buildPetVideoPrompt({
      petName: "Miso",
      dialogue: "Where is my dinner?",
      petPronouns: "he",
      voiceAccent: "french",
    });

    expect(prompt).toContain("French accent");
    expect(prompt).toContain("Do not translate");
    expect(prompt).toContain("Where is my dinner?");
  });
});
