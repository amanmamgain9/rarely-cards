import { ThinkingLevel } from "@google/genai";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_GENERATION_CONFIG,
} from "@/lib/ai/gemini-config";

describe("Gemini generation configuration", () => {
  it("uses Google's supported Gemini 2.5 Flash migration target", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.6-flash");
    expect(GEMINI_GENERATION_CONFIG).toEqual({
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
    });
    expect(GEMINI_GENERATION_CONFIG).not.toHaveProperty("temperature");
    expect(GEMINI_GENERATION_CONFIG.thinkingConfig).not.toHaveProperty(
      "thinkingBudget",
    );
  });
});
