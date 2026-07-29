import { ThinkingLevel, type GenerateContentConfig } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export const GEMINI_GENERATION_CONFIG = {
  responseMimeType: "application/json",
  thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
} satisfies GenerateContentConfig;
