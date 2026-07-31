import { z } from "zod";

export const petDialogueToneSchema = z.enum(["funny", "sweet", "chaotic"]);

export const petDialogueSuggestionSchema = z.object({
  tone: petDialogueToneSchema,
  line: z.string().trim().min(1).max(120),
});

export const petDialogueSuggestionsSchema = z
  .array(petDialogueSuggestionSchema)
  .length(3)
  .superRefine((suggestions, context) => {
    const tones = new Set(suggestions.map((suggestion) => suggestion.tone));
    if (tones.size !== 3) {
      context.addIssue({
        code: "custom",
        message: "Suggestions must include funny, sweet, and chaotic tones.",
      });
    }
  });

export type PetDialogueSuggestion = z.infer<typeof petDialogueSuggestionSchema>;

const dialogueLineJsonSchema = {
  type: "string",
  description: "A short, conversational first-person line grounded in the photo.",
} as const;

function dialogueSuggestionJsonSchema(tone: "funny" | "sweet" | "chaotic") {
  return {
    type: "object",
    properties: {
      tone: { type: "string", enum: [tone] },
      line: dialogueLineJsonSchema,
    },
    required: ["tone", "line"],
    additionalProperties: false,
  } as const;
}

export const petDialogueSuggestionsJsonSchema = {
  type: "array",
  prefixItems: [
    dialogueSuggestionJsonSchema("funny"),
    dialogueSuggestionJsonSchema("sweet"),
    dialogueSuggestionJsonSchema("chaotic"),
  ],
  minItems: 3,
  maxItems: 3,
} as const;

export const petDialogueSchema = z.string().trim().min(1).max(120);

export function buildDialogueSuggestionPrompt() {
  return [
    "Look closely at this single pet photograph and write exactly three short first-person lines the pet could naturally say aloud in an eight-second social video.",
    "Ground every line in visible details: expression, posture, setting, nearby objects, or the moment captured. Do not invent a backstory or owner action that is not visible.",
    "Return one funny line, one sweet line, and one chaotic line. Each line must be conversational, distinct, no more than 16 words, and contain no emoji, hashtags, stage directions, quotation marks, or pet name.",
    'Return only JSON in this shape: [{"tone":"funny","line":"..."},{"tone":"sweet","line":"..."},{"tone":"chaotic","line":"..."}]',
  ].join(" ");
}
