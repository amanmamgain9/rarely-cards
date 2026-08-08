import { Modality, type GoogleGenAI, type Part } from "@google/genai";
import sharp from "sharp";

export async function geminiText({ ai, model, prompt, images = [], temperature = 0.5 }: { ai: GoogleGenAI; model: string; prompt: string; images?: Buffer[]; temperature?: number }) {
  const parts: Part[] = [{ text: prompt }, ...images.map((image) => ({ inlineData: { mimeType: "image/jpeg", data: image.toString("base64") } }))];
  const response = await ai.models.generateContent({ model, contents: [{ role: "user", parts }], config: { temperature } });
  const text = response.text?.trim();
  if (!text) throw new Error("gemini_text_missing");
  return text;
}

export async function geminiJson({ ai, model, prompt, image, schema }: { ai: GoogleGenAI; model: string; prompt: string; image?: Buffer; schema: Record<string, unknown> }) {
  const parts: Part[] = [{ text: prompt }];
  if (image) parts.push({ inlineData: { mimeType: "image/jpeg", data: image.toString("base64") } });
  const response = await ai.models.generateContent({
    model, contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.2 },
  });
  if (!response.text) throw new Error("gemini_json_missing");
  return JSON.parse(response.text) as unknown;
}

export async function geminiImage({ ai, model, prompt, images = [] }: { ai: GoogleGenAI; model: string; prompt: string; images?: Buffer[] }) {
  const parts: Part[] = [{ text: prompt }, ...images.flatMap((image, index) => [
    { text: `Reference image ${index + 1}.` } as Part,
    { inlineData: { mimeType: "image/jpeg", data: image.toString("base64") } } as Part,
  ])];
  const response = await ai.models.generateContent({
    model, contents: [{ role: "user", parts }],
    config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio: "9:16", imageSize: "2K" } },
  });
  const part = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).find((candidate) => candidate.inlineData?.data && candidate.inlineData.mimeType?.startsWith("image/"));
  if (!part?.inlineData?.data) throw new Error(response.promptFeedback?.blockReason ? "image_generation_blocked" : "image_generation_missing");
  return sharp(Buffer.from(part.inlineData.data, "base64")).rotate().resize({ width: 941, height: 1672, fit: "cover" }).png().toBuffer();
}
