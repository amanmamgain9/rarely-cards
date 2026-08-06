import { describe, expect, it } from "vitest";
import { productFeedbackSchema } from "@/lib/feedback";

describe("productFeedbackSchema", () => {
  it("accepts a rating without forcing a written review", () => {
    expect(
      productFeedbackSchema.safeParse({
        kind: "video_experience",
        rating: "loved",
        message: "",
      }).success,
    ).toBe(true);
  });

  it("requires an idea for feature requests", () => {
    expect(
      productFeedbackSchema.safeParse({
        kind: "feature_request",
        message: "",
      }).success,
    ).toBe(false);
  });

  it("rejects oversized notes", () => {
    expect(
      productFeedbackSchema.safeParse({
        kind: "feature_request",
        message: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });
});
