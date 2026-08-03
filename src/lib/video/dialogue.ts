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

const petPhotoRejectionReasonSchema = z.enum([
  "no_pet",
  "multiple_pets",
  "unsupported_subject",
  "too_blurry",
  "too_obscured",
  "pet_too_small",
]);

export const petDialogueResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("accepted"),
    suggestions: petDialogueSuggestionsSchema,
  }),
  z.object({
    status: z.literal("rejected"),
    reason: petPhotoRejectionReasonSchema,
    message: z.string().trim().min(2).max(180),
  }),
]);

export type PetDialogueResult = z.infer<typeof petDialogueResultSchema>;

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

const orderedDialogueSuggestionsJsonSchema = {
  type: "array",
  prefixItems: [
    dialogueSuggestionJsonSchema("funny"),
    dialogueSuggestionJsonSchema("sweet"),
    dialogueSuggestionJsonSchema("chaotic"),
  ],
  minItems: 3,
  maxItems: 3,
} as const;

export const petDialogueResultJsonSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["accepted", "rejected"] },
    suggestions: orderedDialogueSuggestionsJsonSchema,
    reason: {
      type: "string",
      enum: [
        "no_pet",
        "multiple_pets",
        "unsupported_subject",
        "too_blurry",
        "too_obscured",
        "pet_too_small",
      ],
    },
    message: {
      type: "string",
      description: "A brief, kind, specific instruction for a better pet photo.",
    },
  },
  required: ["status"],
  additionalProperties: false,
} as const;

export const petDialogueSchema = z.string().trim().min(1).max(120);

export function buildDialogueSuggestionPrompt() {
  return [
    "First decide whether this is a usable photograph of exactly one prominent cat or dog.",
    "Reject images with no pet, multiple prominent pets, an unsupported animal, a non-photograph, or a pet that is too blurry, obscured, or small to read clearly. Never invent pet dialogue for a rejected image.",
    'For a rejection, return only: {"status":"rejected","reason":"no_pet|multiple_pets|unsupported_subject|too_blurry|too_obscured|pet_too_small","message":"A brief, kind, specific instruction for a better pet photo."}',
    "For an accepted image, look closely at the single pet photograph and write exactly three short first-person lines the pet could naturally say aloud in an eight-second social video.",
    "Ground every line in visible details: expression, posture, setting, nearby objects, or the moment captured. Do not invent a backstory or owner action that is not visible.",
    "Return one funny line, one sweet line, and one chaotic line. Each line must be conversational, distinct, no more than 16 words, and contain no emoji, hashtags, stage directions, quotation marks, or pet name.",
    'For an accepted image, return only JSON in this shape: {"status":"accepted","suggestions":[{"tone":"funny","line":"..."},{"tone":"sweet","line":"..."},{"tone":"chaotic","line":"..."}]}',
  ].join(" ");
}
