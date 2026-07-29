import "server-only";

import { GoogleGenAI } from "@google/genai";
import { GEMINI_GENERATION_CONFIG } from "@/lib/ai/gemini-config";
import {
  analysisResultSchema,
  type AnalysisResult,
  type CardStyle,
  type PetPronouns,
} from "@/lib/analysis/types";
import { validateAnalysisContract } from "@/lib/analysis/validate-result";
import { serverEnv } from "@/lib/env";
import { buildPetRarityPrompt } from "@/lib/rarity/pet-prompt";

let geminiClient: GoogleGenAI | null = null;

function getGemini() {
  geminiClient ??= new GoogleGenAI({ apiKey: serverEnv().geminiApiKey });
  return geminiClient;
}

function isTransient(error: unknown) {
  const candidate = error as { status?: number; code?: number; message?: string };
  const status = candidate.status ?? candidate.code;
  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    /timeout|temporar|unavailable|rate limit/i.test(candidate.message ?? "")
  );
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function analyzePet({
  image,
  style,
  petName,
  pronouns,
}: {
  image: Buffer;
  style: CardStyle;
  petName: string;
  pronouns: PetPronouns;
}): Promise<AnalysisResult> {
  const env = serverEnv();
  if (style !== "pet") throw new Error("invalid_model_schema");
  const prompt = buildPetRarityPrompt(petName, pronouns);
  let transientRetries = 0;
  let schemaRetries = 0;

  for (;;) {
    try {
      const response = await getGemini().models.generateContent({
        model: env.geminiModel,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: image.toString("base64"),
                },
              },
            ],
          },
        ],
        config: GEMINI_GENERATION_CONFIG,
      });

      try {
        const parsed = analysisResultSchema.parse(JSON.parse(response.text ?? ""));
        return validateAnalysisContract(parsed, style, petName, pronouns);
      } catch {
        if (schemaRetries >= 1) throw new Error("invalid_model_schema");
        schemaRetries += 1;
        continue;
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "invalid_model_schema"
      ) {
        throw error;
      }
      if (!isTransient(error) || transientRetries >= 2) throw error;
      await wait(500 * 2 ** transientRetries);
      transientRetries += 1;
    }
  }
}
