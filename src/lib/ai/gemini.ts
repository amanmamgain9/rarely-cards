import "server-only";

import { GoogleGenAI } from "@google/genai";
import { serverEnv } from "@/lib/env";
import {
  analysisResultSchema,
  type AnalysisResult,
  type CardStyle,
  type PetPronouns,
} from "@/lib/analysis/types";
import { validateAnalysisContract } from "@/lib/analysis/validate-result";
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

function providerStatus(error: unknown) {
  const candidate = error as { status?: number; code?: number };
  return candidate.status ?? candidate.code ?? null;
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
  const models = Array.from(
    new Set([env.geminiModel, "gemini-2.5-flash-lite"]),
  );
  let modelIndex = 0;
  let transientRetries = 0;
  let schemaRetries = 0;

  for (;;) {
    try {
      const response = await getGemini().models.generateContent({
        model: models[modelIndex],
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
        config: {
          responseMimeType: "application/json",
          temperature: 0.35,
          thinkingConfig: { thinkingBudget: 512 },
        },
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
      if (providerStatus(error) === 404 && modelIndex < models.length - 1) {
        modelIndex += 1;
        transientRetries = 0;
        schemaRetries = 0;
        continue;
      }
      if (!isTransient(error) || transientRetries >= 2) throw error;
      await wait(500 * 2 ** transientRetries);
      transientRetries += 1;
    }
  }
}
