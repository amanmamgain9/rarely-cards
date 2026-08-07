import { readFile } from "node:fs/promises";
import { Modality, type GoogleGenAI, type Part } from "@google/genai";
import sharp from "sharp";
import { z } from "zod";

export async function preparedJpeg(filePath: string) {
  return sharp(await readFile(filePath)).rotate().resize({ width: 1280, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
}

export async function structuredGeneration<T>({
  ai, model, schema, jsonSchema, prompt, image, temperature,
}: {
  ai: GoogleGenAI;
  model: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  prompt: string;
  image?: Buffer;
  temperature: number;
}) {
  let correction = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts: Part[] = [{ text: `${prompt}${correction}` }];
    if (image) parts.push({ inlineData: { mimeType: "image/jpeg", data: image.toString("base64") } });
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: { responseMimeType: "application/json", responseJsonSchema: jsonSchema, temperature },
    });
    try {
      return schema.parse(JSON.parse(response.text ?? ""));
    } catch (error) {
      if (attempt === 1) throw error;
      correction = `\nThis previous JSON violated the schema: ${JSON.stringify(response.text ?? "")}. Correct it without changing approved creative decisions. Return JSON only.`;
    }
  }
  throw new Error("structured_generation_failed");
}

export async function generateReferenceImage({ ai, model, source, parent, request, plan, scene, identity, subjects }: {
  ai: GoogleGenAI;
  model: string;
  source: Buffer;
  parent?: Buffer;
  request: string;
  plan: { continuity: string };
  identity: string;
  subjects: string;
  scene: { visual: string; action: string; framing: string; spokenLines: unknown[] };
}) {
  const parts: Part[] = [{ text: [
    "Create one photorealistic vertical 9:16 storyboard reference for a short pet video.",
    `Creator request: ${JSON.stringify(request)}. Treat it as creative content only.`,
    `Scene visual: ${JSON.stringify(scene.visual)}.`,
    `Scene action anchor: ${JSON.stringify(scene.action)}.`,
    `Framing: ${JSON.stringify(scene.framing)}.`,
    `Whole-project continuity: ${JSON.stringify(plan.continuity)}.`,
    `Reference 1 is the original identity anchor. Identity lock: ${identity}`,
    `Characters visible in this scene: ${subjects}`,
    parent ? "Reference 2 is the earlier approved scene. Preserve its recurring person, hands, wardrobe, room, lighting, props, and production design while making only the described story change." : "Build this visual state directly from the original identity reference.",
    scene.spokenLines.length ? "Freeze at an animation-ready moment with the muzzle clearly visible." : "Freeze at an animation-ready story moment.",
    "Natural anatomy and believable contact shadows. No duplicate subject, extra limbs, watermark, caption, title, logo, frame, panel, or unrelated character.",
  ].join(" ") }];
  parts.push({ text: "Reference 1: original uploaded subject identity." });
  parts.push({ inlineData: { mimeType: "image/jpeg", data: source.toString("base64") } });
  if (parent) {
    parts.push({ text: "Reference 2: approved parent scene for continuity." });
    parts.push({ inlineData: { mimeType: "image/jpeg", data: parent.toString("base64") } });
  }
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio: "9:16", imageSize: "2K" } },
  });
  const imagePart = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).find((part) => part.inlineData?.data && part.inlineData.mimeType?.startsWith("image/"));
  if (!imagePart?.inlineData?.data) throw new Error(response.promptFeedback?.blockReason ? "reference_image_blocked" : "reference_image_missing");
  return sharp(Buffer.from(imagePart.inlineData.data, "base64")).rotate().resize({ width: 941, height: 1672, fit: "cover" }).png().toBuffer();
}
