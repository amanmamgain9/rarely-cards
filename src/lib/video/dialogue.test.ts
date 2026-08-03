import { describe, expect, it } from "vitest";
import {
  buildDialogueSuggestionPrompt,
  petDialogueSchema,
  petDialogueResultJsonSchema,
  petDialogueResultSchema,
  petDialogueSuggestionsSchema,
} from "@/lib/video/dialogue";

describe("talking-pet dialogue", () => {
  it("accepts one suggestion for every simple tone", () => {
    expect(
      petDialogueSuggestionsSchema.parse([
        { tone: "funny", line: "I was told there would be snacks." },
        { tone: "sweet", line: "This is my favorite place because you are here." },
        { tone: "chaotic", line: "Open the door. I have plans." },
      ]),
    ).toHaveLength(3);
  });

  it("limits custom speech to 120 characters", () => {
    expect(petDialogueSchema.safeParse("x".repeat(120)).success).toBe(true);
    expect(petDialogueSchema.safeParse("x".repeat(121)).success).toBe(false);
  });

  it("grounds suggestions in the photograph", () => {
    expect(buildDialogueSuggestionPrompt()).toContain("visible details");
    expect(buildDialogueSuggestionPrompt()).toContain("Never invent pet dialogue");
  });

  it("gives Gemini accepted and rejected structured-output paths", () => {
    expect(petDialogueResultJsonSchema).toMatchObject({
      type: "object",
      properties: {
        status: { enum: ["accepted", "rejected"] },
        suggestions: {
          minItems: 3,
          maxItems: 3,
          prefixItems: [
            { properties: { tone: { enum: ["funny"] } } },
            { properties: { tone: { enum: ["sweet"] } } },
            { properties: { tone: { enum: ["chaotic"] } } },
          ],
        },
      },
    });
  });

  it("accepts a photo rejection without fabricated suggestions", () => {
    expect(
      petDialogueResultSchema.parse({
        status: "rejected",
        reason: "no_pet",
        message: "Choose a photo with one clear cat or dog.",
      }),
    ).toMatchObject({ status: "rejected", reason: "no_pet" });
  });
});
