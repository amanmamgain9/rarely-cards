import type { GoogleGenAI } from "@google/genai";
import type { CharacterProfile } from "./identity.ts";
import { structuredGeneration } from "./model.ts";
import { treatmentJsonSchema, videoTreatmentSchema, type Hook, type VideoTreatment } from "./schemas.ts";

export async function refineTreatment({ ai, model, request, characters, hook, draft, creativeBrief }: {
  ai: GoogleGenAI;
  model: string;
  request: string;
  characters: CharacterProfile[];
  hook: Hook;
  draft: VideoTreatment;
  creativeBrief: string;
}) {
  return structuredGeneration({
    ai, model, schema: videoTreatmentSchema, jsonSchema: treatmentJsonSchema, temperature: 0.55,
    prompt: [
      "Perform one final creative-director pass on this short video treatment.",
      `Creator request: ${JSON.stringify(request)}.`,
      `Canonical characters: ${JSON.stringify(characters)}.`,
      `Locked hook: ${JSON.stringify(hook)}.`,
      `First-pass treatment: ${JSON.stringify(draft)}.`,
      `Specialist quality brief: ${creativeBrief}`,
      "Improve emotional coherence, specificity, pacing, performance, dialogue delivery, and payoff.",
      "Preserve explicit creator details, factual boundaries, locked hook meaning, and duration limit.",
      "Creative choices may change when they strengthen the result. Do not add camera directions or provider syntax. Return the complete revised treatment as JSON only.",
    ].join(" "),
  });
}
