import { z } from "zod";

export const videoGenerationStatusSchema = z.enum([
  "submitting",
  "running",
  "succeeded",
  "failed",
]);

export type VideoGenerationStatus = z.infer<
  typeof videoGenerationStatusSchema
>;

export type PublicVideoGeneration = {
  id: string;
  analysisId: string;
  status: VideoGenerationStatus;
  videoUrl: string | null;
  canRetry: boolean;
  createdAt: string;
  updatedAt: string;
};
