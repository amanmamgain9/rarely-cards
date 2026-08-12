import { Modality, type GoogleGenAI, type Part } from "@google/genai";

export async function geminiJson({ ai, model, prompt, image, images = [], schema }: { ai: GoogleGenAI; model: string; prompt: string; image?: Buffer; images?: Buffer[]; schema: Record<string, unknown> }) {
  const parts: Part[] = [{ text: prompt }];
  for (const [index, input] of [...(image ? [image] : []), ...images].entries()) {
    parts.push({ text: `Image ${index + 1}` }, { inlineData: { mimeType: "image/jpeg", data: input.toString("base64") } });
  }
  const response = await ai.models.generateContent({
    model, contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.2 },
  });
  if (!response.text) throw new Error("gemini_json_missing");
  return JSON.parse(response.text) as unknown;
}

export async function geminiImage({ ai, model, prompt }: { ai: GoogleGenAI; model: string; prompt: string }) {
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio: "9:16", imageSize: "2K" } },
  });
  const part = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).find((candidate) => candidate.inlineData?.data && candidate.inlineData.mimeType?.startsWith("image/"));
  if (!part?.inlineData?.data) throw new Error(response.promptFeedback?.blockReason ? "image_generation_blocked" : "image_generation_missing");
  return Buffer.from(part.inlineData.data, "base64");
}
