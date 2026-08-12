import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { z } from "zod";
import { geminiImage, geminiJson } from "../providers/gemini.ts";
import { currentArtifact, finishTrace, saveCanon, startTrace, type ProjectReferenceInput, type SubjectCanon, type VideoProject } from "../store/index.ts";

const skillPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "SKILL.md");
const referencePromptSkillPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "reference-image-prompting", "SKILL.md");
const canonSchema = z.object({ kind: z.string().trim().min(1).max(40), visibleTraits: z.array(z.string().trim().min(1).max(80)).max(3), continuity: z.array(z.string().trim().min(1).max(120)).max(6), voice: z.string().trim().max(200) });
const canonJsonSchema = { type: "object", required: ["kind", "visibleTraits", "continuity", "voice"], properties: { kind: { type: "string" }, visibleTraits: { type: "array", maxItems: 3, items: { type: "string" } }, continuity: { type: "array", maxItems: 6, items: { type: "string" } }, voice: { type: "string" } } };
const reviewSchema = z.object({ accepted: z.boolean(), reason: z.string().trim().min(1) });
const reviewJsonSchema = { type: "object", required: ["accepted", "reason"], properties: { accepted: { type: "boolean" }, reason: { type: "string" } } };
const generatedReferenceSchema = z.object({ role: z.enum(["environment", "interface", "production", "style"]), description: z.string().trim().min(1), prompt: z.string().trim().min(1) });
const referenceSetSchema = z.object({ references: z.array(generatedReferenceSchema) });
const referenceSetJsonSchema = { type: "object", required: ["references"], properties: { references: { type: "array", items: { type: "object", required: ["role", "description", "prompt"], properties: { role: { type: "string", enum: ["environment", "interface", "production", "style"] }, description: { type: "string" }, prompt: { type: "string" } } } } } };
type GeneratedReference = z.infer<typeof generatedReferenceSchema>;

export async function generateProjectReferences({ project, ai, imageModel, reviewModel }: { project: VideoProject; ai: GoogleGenAI; imageModel: string; reviewModel: string }) {
  if (!project.canon) throw new Error("canon_missing");
  const plan = currentArtifact(project, "plan");
  const trace = await startTrace(project, { owner: "visual", operation: "generate-project-references", inputArtifactIds: [plan.id], models: [imageModel, reviewModel] });
  try {
    const [skill, promptSkill] = await Promise.all([readFile(skillPath, "utf8"), readFile(referencePromptSkillPath, "utf8")]);
    const outputDir = path.join(project.outputDir, "references");
    await mkdir(outputDir, { recursive: true });
    const existing = project.canon.references;
    const existingImages = await Promise.all(existing.map(({ path: filePath }) => readFile(filePath)));
    let reason = "";
    let pending: Array<{ input: GeneratedReference; image: Buffer }> | undefined;
    for (let attempt = 0; attempt < 2 && !pending; attempt += 1) {
      const selection = referenceSetSchema.parse(await geminiJson({
        ai, model: reviewModel, images: existingImages, schema: referenceSetJsonSchema,
        prompt: `${skill}\n\n${promptSkill}\n\nLocked production plan:\n${plan.content}\n\nExisting reference map:\n${existing.map((reference, index) => `Image ${index + 1}: ${reference.role}; ${reference.description}`).join("\n")}\n\n${reason ? `Previous set rejection:\n${reason}\n\n` : ""}Choose minimum additional reference set and author each final image prompt. Return JSON only.`,
      }));
      if (!selection.references.length) {
        await finishTrace(project, trace, "accepted", "Visual Agent chose no additional production references.");
        return;
      }
      const candidate = [] as Array<{ input: GeneratedReference; image: Buffer }>;
      for (const input of selection.references) {
        const image = await geminiImage({ ai, model: imageModel, prompt: `${skill}\n\n${input.prompt}\n\nOutput pixels only.` });
        candidate.push({ input, image });
      }
      const review = reviewSchema.parse(await geminiJson({
        ai, model: reviewModel, images: [...existingImages, ...candidate.map(({ image }) => image)], schema: reviewJsonSchema,
        prompt: `${skill}\n\n${promptSkill}\n\nInspect whole reference set against locked plan. Existing images:\n${existing.map((reference, index) => `Image ${index + 1}: ${reference.role}; ${reference.description}`).join("\n")}\nCandidate images:\n${candidate.map(({ input }, index) => `Image ${existing.length + index + 1}: ${input.role}; ${input.description}; prompt: ${input.prompt}`).join("\n")}\n\nReject overlap, contradiction, misleading medium, wrong role, unusable composition, extra subjects, anatomy problems, stray text, logos, or watermarks. Return JSON only.`,
      }));
      reason = review.reason;
      if (review.accepted) pending = candidate;
    }
    if (!pending) throw new Error(`generated_reference_set_rejected:${reason}`);
    const written: ProjectReferenceInput[] = [];
    for (const { input, image } of pending) {
      const index = project.referenceInputs.filter(({ role }) => role === input.role).length + 1;
      const filePath = path.join(outputDir, `${input.role}_${index}.png`);
      await writeFile(filePath, await sharp(image).rotate().png().toBuffer());
      const saved = { path: filePath, role: input.role, description: input.description };
      project.referenceInputs.push(saved);
      written.push(saved);
    }
    for (const input of written) {
      const index = project.canon.references.filter(({ role }) => role === input.role).length + 1;
      project.canon.references.push({ id: `${input.role}_${index}`, ...input, characterIds: [] });
    }
    await saveCanon(project, project.canon);
    await finishTrace(project, trace, "accepted", `${pending.length} Visual Agent-selected reference image(s) accepted.`);
  } catch (error) {
    await finishTrace(project, trace, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function createSubjectCanon({ project, ai, model }: { project: VideoProject; ai: GoogleGenAI; model: string }) {
  const trace = await startTrace(project, { owner: "visual", operation: "canon-setup", inputArtifactIds: [], models: [model] });
  try {
    const characterInputs = project.referenceInputs.filter(({ role }) => role === "character");
    if (!characterInputs.length) throw new Error("character_reference_missing");
    const skill = await readFile(skillPath, "utf8");
    const characters: SubjectCanon["characters"] = [];
    const continuity: string[] = [];
    for (const [index, input] of characterInputs.entries()) {
      const source = await sharp(await readFile(input.path)).rotate().resize({ width: 1280, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
      const result = canonSchema.parse(await geminiJson({
        ai, model, image: source, schema: canonJsonSchema,
        prompt: `${skill}\n\nExtract immutable canon for character_${index + 1}. Description is context only: ${JSON.stringify(input.description)}. Return JSON only.`,
      }));
      characters.push({ id: `character_${index + 1}`, role: index ? "supporting_subject" : "primary_subject", kind: result.kind.toLowerCase(), identityReferenceId: `identity_${index + 1}`, visibleTraits: result.visibleTraits, voice: result.voice || undefined });
      continuity.push(...result.continuity.map((item) => `character_${index + 1}: ${item}`));
    }
    const counts = { character: 0, environment: 0, interface: 0, production: 0, style: 0 };
    const canon: SubjectCanon = {
      createdAt: new Date().toISOString(),
      characters,
      references: project.referenceInputs.map((input) => {
        counts[input.role] += 1;
        const characterIndex = input.role === "character" ? characterInputs.findIndex(({ path: candidate }) => candidate === input.path) + 1 : 0;
        return { id: input.role === "character" ? `identity_${characterIndex}` : `${input.role}_${counts[input.role]}`, path: input.path, role: input.role, description: input.description, characterIds: characterIndex ? [`character_${characterIndex}`] : [] };
      }),
      continuity,
    };
    await saveCanon(project, canon);
    await finishTrace(project, trace, "accepted", `${characters.length} character identity reference(s) mapped.`);
    return canon;
  } catch (error) {
    await finishTrace(project, trace, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
