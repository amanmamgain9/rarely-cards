import "server-only";

import { GoogleGenAI } from "@google/genai";
import { geminiEnv } from "@/lib/env";
import {
  buildDialogueSuggestionPrompt,
  petDialogueResultJsonSchema,
  petDialogueResultSchema,
  type PetDialogueResult,
} from "@/lib/video/dialogue";

let geminiClient: GoogleGenAI | null = null;

function getGemini() {
  geminiClient ??= new GoogleGenAI({ apiKey: geminiEnv().geminiApiKey });
  return geminiClient;
}

export async function suggestPetDialogue(
  image: Buffer,
): Promise<PetDialogueResult> {
  const env = geminiEnv();
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
              { text: buildDialogueSuggestionPrompt() },
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
          responseJsonSchema: petDialogueResultJsonSchema,
        },
      });
      try {
        return petDialogueResultSchema.parse(
          JSON.parse(response.text ?? ""),
        );
      } catch {
        if (schemaRetries >= 1) throw new Error("invalid_dialogue_schema");
        schemaRetries += 1;
      }
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_dialogue_schema") {
        throw error;
      }
      if (!isTransient(error) || transientRetries >= 2) throw error;
      await wait(500 * 2 ** transientRetries);
      transientRetries += 1;
    }
  }
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
