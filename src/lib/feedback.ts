import { z } from "zod";

export const feedbackKindSchema = z.enum([
  "video_experience",
  "feature_request",
]);

export const feedbackRatingSchema = z.enum(["loved", "okay", "needs_work"]);

export const productFeedbackSchema = z
  .object({
    kind: feedbackKindSchema,
    videoId: z.string().uuid().optional(),
    rating: feedbackRatingSchema.optional(),
    message: z.string().trim().max(1000).default(""),
  })
  .superRefine((value, context) => {
    if (value.kind === "video_experience" && !value.rating) {
      context.addIssue({
        code: "custom",
        path: ["rating"],
        message: "Choose how the video felt.",
      });
    }
    if (value.kind === "feature_request" && value.message.length < 3) {
      context.addIssue({
        code: "custom",
        path: ["message"],
        message: "Tell us a little about the feature.",
      });
    }
  });

export type ProductFeedback = z.infer<typeof productFeedbackSchema>;
