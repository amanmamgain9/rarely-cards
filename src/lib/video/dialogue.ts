import { z } from "zod";

export const petDialogueToneSchema = z.enum(["funny", "sweet", "chaotic"]);

export const petDialogueSuggestionSchema = z.object({
  tone: petDialogueToneSchema,
  line: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine((line) => line.split(/\s+/u).length <= 16, {
      message: "Dialogue suggestions must contain no more than 16 words.",
    })
    .refine((line) => !/[“”"\[\]{}]/u.test(line), {
      message: "Dialogue suggestions must not contain quotes or stage directions.",
    }),
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
    const lines = new Set(
      suggestions.map((suggestion) =>
        suggestion.line.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, " ").trim(),
      ),
    );
    if (lines.size !== suggestions.length) {
      context.addIssue({
        code: "custom",
        message: "Dialogue suggestions must be meaningfully distinct.",
      });
    }
  });

const mommyDialogueSuggestionsSchema = petDialogueSuggestionsSchema.superRefine(
  (suggestions, context) => {
    suggestions.forEach((suggestion, index) => {
      if (!/\bmommy\b/iu.test(suggestion.line)) {
        context.addIssue({
          code: "custom",
          path: [index, "line"],
          message: "Every mommy-flow suggestion must address Mommy.",
        });
      }
    });
  },
);

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
    suggestions: mommyDialogueSuggestionsSchema,
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

const orderedDialogueSuggestionsJsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      tone: { type: "string", enum: ["funny", "sweet", "chaotic"] },
      line: dialogueLineJsonSchema,
    },
    required: ["tone", "line"],
    additionalProperties: false,
  },
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

export function buildDialogueSuggestionPrompt({ retry = false } = {}) {
  return [
    "First decide whether this is a usable photograph of exactly one prominent cat or dog.",
    "Reject images with no pet, multiple prominent pets, an unsupported animal, a non-photograph, or a pet that is too blurry, obscured, or small to read clearly. Never invent pet dialogue for a rejected image.",
    'For a rejection, return only: {"status":"rejected","reason":"no_pet|multiple_pets|unsupported_subject|too_blurry|too_obscured|pet_too_small","message":"A brief, kind, specific instruction for a better pet photo."}',
    "For an accepted image, look closely at the single pet photograph and write exactly three short first-person lines the pet could naturally say aloud in an eight-second social video.",
    "This is a pet-to-Mommy keepsake flow. Every line must speak directly to the pet’s female caregiver using the exact word Mommy and make their bond feel personal.",
    "Ground each line in visible details: the pet’s expression, posture, setting, nearby objects, or mood. You may express affection, missing Mommy, wanting her attention, or welcoming her home, but do not invent a specific unseen event as fact.",
    "Keep the emotion warm and believable. Never imply death, illness, neglect, abandonment, danger, or guilt, and never shame Mommy for leaving.",
    "Return one funny line, one genuinely tender sweet line, and one playfully chaotic line. The three ideas must be meaningfully different, natural to say aloud, and not generic motivational copy.",
    "Each line must contain no more than 16 words and no emoji, hashtags, stage directions, quotation marks, pet name, or repeated wording.",
    retry
      ? "A previous answer failed validation. Check every constraint carefully before returning the replacement."
      : null,
    'For an accepted image, return only JSON in this shape: {"status":"accepted","suggestions":[{"tone":"funny","line":"..."},{"tone":"sweet","line":"..."},{"tone":"chaotic","line":"..."}]}',
  ].filter(Boolean).join(" ");
}
