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
        { tone: "funny", line: "Mommy, this face deserves at least one snack." },
        { tone: "sweet", line: "Mommy, every quiet moment is better beside you." },
        { tone: "chaotic", line: "Mommy, come back. I have reorganized everything." },
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
    expect(buildDialogueSuggestionPrompt()).toContain("pet-to-Mommy keepsake flow");
    expect(buildDialogueSuggestionPrompt()).toContain("never shame Mommy");
  });

  it("rejects low-quality generated dialogue", () => {
    expect(
      petDialogueSuggestionsSchema.safeParse([
        { tone: "funny", line: 'Mommy said "snacks".' },
        { tone: "sweet", line: "Mommy, I love sitting here with you every single afternoon because you are my favorite person." },
        { tone: "chaotic", line: "Mommy said snacks." },
      ]).success,
    ).toBe(false);
  });

  it("adds a validation reminder when Gemini retries", () => {
    expect(buildDialogueSuggestionPrompt({ retry: true })).toContain(
      "previous answer failed validation",
    );
  });

  it("gives Gemini accepted and rejected structured-output paths", () => {
    expect(petDialogueResultJsonSchema).toMatchObject({
      type: "object",
      properties: {
        status: { enum: ["accepted", "rejected"] },
        suggestions: {
          minItems: 3,
          maxItems: 3,
          items: {
            properties: {
              tone: { enum: ["funny", "sweet", "chaotic"] },
            },
          },
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
