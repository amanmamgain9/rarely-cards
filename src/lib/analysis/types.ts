import { z } from "zod";

export const cardStyleSchema = z.enum(["feminine", "masculine", "pet"]);
export type CardStyle = z.infer<typeof cardStyleSchema>;
export const petNameSchema = z.string().trim().min(1).max(30);
export const petPronounsSchema = z.enum(["he", "she", "they"]);
export type PetPronouns = z.infer<typeof petPronounsSchema>;
export const petEnergySchema = z.enum([
  "regal",
  "goofy",
  "chaotic",
  "serene",
  "eager",
  "curious",
  "playful",
  "sleepy",
]);
export type PetEnergy = z.infer<typeof petEnergySchema>;

export const analysisStatusSchema = z.enum([
  "awaiting_upload",
  "awaiting_payment",
  "payment_pending",
  "awaiting_name",
  "paid",
  "processing",
  "photo_rejected",
  "completed",
  "refund_pending",
  "refunded",
  "failed",
  "disputed",
]);
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;

const scoreSchema = z.number().int().min(0).max(100);
const rarityScoreSchema = z.number().int().min(70).max(100);
const signatureReadSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const candidate = value as Record<string, unknown>;
  if (candidate.thought === undefined && typeof candidate.reason === "string") {
    return { ...candidate, thought: candidate.reason };
  }
  return value;
}, z.object({
  title: z.string().trim().min(2).max(40),
  score: scoreSchema,
  thought: z.string().trim().min(2).max(160),
}));

export const acceptedAnalysisSchema = z.object({
  status: z.literal("accepted"),
  petName: petNameSchema.optional(),
  pronouns: petPronounsSchema.optional(),
  species: z.enum(["cat", "dog"]).optional(),
  energy: petEnergySchema.optional(),
  cardTitle: z.string().trim().min(2).max(48),
  rarityScore: rarityScoreSchema,
  signatureRead: signatureReadSchema,
  ratings: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(40),
        score: scoreSchema,
        phrase: z.string().trim().min(1).max(40),
        reason: z.string().trim().min(1).max(160),
      }),
    )
    .min(4)
    .max(8),
  fieldNote: z.string().trim().min(2).max(120).optional(),
  inscription: z.string().trim().min(2).max(220).optional(),
});

export const rejectedAnalysisSchema = z.object({
  status: z.literal("rejected"),
  reason: z.enum([
    "no_pet",
    "multiple_pets",
    "unsupported_subject",
    "too_blurry",
    "too_obscured",
    "pet_too_small",
  ]),
  message: z.string().trim().min(2).max(180),
});

export const analysisResultSchema = z.discriminatedUnion("status", [
  acceptedAnalysisSchema,
  rejectedAnalysisSchema,
]);

export type AcceptedAnalysis = z.infer<typeof acceptedAnalysisSchema>;
export type RejectedAnalysis = z.infer<typeof rejectedAnalysisSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export type PublicAnalysis = {
  id: string;
  cardStyle: CardStyle;
  status: AnalysisStatus;
  result: AcceptedAnalysis | null;
  rejectionMessage: string | null;
  replacementCount: number;
  createdAt: string;
  updatedAt: string;
  photoUrl: string | null;
  refundState: "none" | "pending" | "completed";
};

