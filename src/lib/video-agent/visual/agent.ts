import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { z } from "zod";
import { geminiImage, geminiJson, geminiText } from "../providers/gemini.ts";
import { artifact, assertCurrentInputs, finishTrace, media, reserveImageGeneration, saveArtifact, saveCanon, saveMedia, startTrace, type ProductionPlan, type SubjectCanon, type VideoProject } from "../store/index.ts";

const skillPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "SKILL.md");
const canonSchema = z.object({ kind: z.string().trim().min(1).max(40), visibleTraits: z.array(z.string().trim().min(1).max(80)).max(3), continuity: z.array(z.string().trim().min(1).max(120)).max(6), voice: z.string().trim().max(200) });
const canonJsonSchema = { type: "object", required: ["kind", "visibleTraits", "continuity", "voice"], properties: { kind: { type: "string" }, visibleTraits: { type: "array", maxItems: 3, items: { type: "string" } }, continuity: { type: "array", maxItems: 6, items: { type: "string" } }, voice: { type: "string" } } };

async function skill() {
  return readFile(skillPath, "utf8");
}

async function preparedImage(filePath: string) {
  return sharp(await readFile(filePath)).rotate().resize({ width: 1280, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
}

export async function createSubjectCanon({ project, ai, model }: { project: VideoProject; ai: GoogleGenAI; model: string }) {
  const trace = await startTrace(project, { owner: "visual", operation: "canon-setup", inputArtifactIds: [], models: [model] });
  try {
    const source = await preparedImage(project.sourcePath);
    const result = canonSchema.parse(await geminiJson({
      ai, model, image: source, schema: canonJsonSchema,
      prompt: `${await skill()}\n\nClassify primary visible subject for immutable project canon. Use at most 3 short uniquely distinguishing visible traits; no breed/category inside traits, clothing, pose, background, or lighting. Continuity contains only stable body/identity facts. Voice is one stable voice identity appropriate to subject. If subject is a pet, make voice tiny, sweet, soft, innocent, affectionate, expressive, clear, and baby-like without changing intelligence or syntax. Return JSON only.`,
    }));
    const canon: SubjectCanon = {
      createdAt: new Date().toISOString(),
      characters: [{ id: "character_1", role: "primary_subject", kind: result.kind.toLowerCase(), identityReferenceId: "identity_1", visibleTraits: result.visibleTraits, voice: result.voice || undefined }],
      references: [{ id: "identity_1", path: project.sourcePath, characterIds: ["character_1"] }],
      continuity: result.continuity,
    };
    await saveCanon(project, canon);
    await finishTrace(project, trace, "accepted", "Canonical identity established from reference pixels.");
    return canon;
  } catch (error) {
    await finishTrace(project, trace, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function visualConceptVerdict({ project, ai, model, concept, question }: { project: VideoProject; ai: GoogleGenAI; model: string; concept: string; question: string }) {
  if (!project.canon) throw new Error("canon_missing");
  const source = await preparedImage(project.sourcePath);
  return geminiText({
    ai, model, images: [source], temperature: 0.3,
    prompt: `${await skill()}\n\nGive text-only Visual Agent verdict. Concept: ${concept}\nQuestion: ${question}\nCanon: ${JSON.stringify(project.canon)}\nAnswer in at most 100 words. Diagnose readability, identity/product desirability, spatial feasibility, and accidental meaning. Do not rewrite story or hook.`,
  });
}

type BoardFrame = { shotId: string; mediaId: string; reason: string };
type BoardManifest = { planId: string; deliveryId: string; frames: BoardFrame[] };
type Strategy = { kind: "fresh" } | { kind: "edit"; shotId: string };

function boardManifest(content: string) {
  return JSON.parse(content) as BoardManifest;
}

function strategy(text: string, buffers: Map<string, Buffer>): Strategy {
  const edit = text.match(/^(?:RETRY\s+)?EDIT\s+(shot_\d+)/i)?.[1];
  if (edit && buffers.has(edit)) return { kind: "edit", shotId: edit };
  if (/^(?:RETRY\s+)?FRESH\b/i.test(text)) return { kind: "fresh" };
  throw new Error(`visual_strategy_invalid:${text}`);
}

async function chooseStrategy({ ai, model, shot, prior }: { ai: GoogleGenAI; model: string; shot: ProductionPlan["shots"][number]; prior: ProductionPlan["shots"] }) {
  return geminiText({ ai, model, temperature: 0.1, prompt: `${await skill()}\n\nChoose reference strategy for this shot. Shot: ${JSON.stringify(shot)}\nAccepted earlier shots: ${JSON.stringify(prior)}\nReturn exactly FRESH or EDIT shot_N, then one short reason.` });
}

async function directFrame({ ai, model, source, parent, plan, shot, delivery, canon, feedback }: { ai: GoogleGenAI; model: string; source: Buffer; parent?: Buffer; plan: ProductionPlan; shot: ProductionPlan["shots"][number]; delivery: string; canon: SubjectCanon; feedback?: string }) {
  return geminiText({
    ai, model, images: shot.subjects.length ? (parent ? [source, parent] : [source]) : [], temperature: 0.65,
    prompt: `${await skill()}\n\nDirect one strongest frozen 9:16 instant for this locked shot. Return image-generation direction only.\nShot: ${JSON.stringify(shot)}\nPlan continuity: ${plan.continuity}\nDelivery for acting only: ${delivery}\nCanon: ${JSON.stringify(canon)}\n${shot.subjects.length ? "Input image 1 owns character_1 identity." : "No canonical subject appears."}${parent ? " Input image 2 supplies continuity, not mandatory pose." : " Fresh generation."}${feedback ? `\nPrevious pixel inspection: ${feedback}` : ""}`,
  });
}

async function inspectFrame({ ai, model, frame, source, direction, shot, canon }: { ai: GoogleGenAI; model: string; frame: Buffer; source: Buffer; direction: string; shot: ProductionPlan["shots"][number]; canon: SubjectCanon }) {
  return geminiText({
    ai, model, images: [source, frame], temperature: 0.1,
    prompt: `${await skill()}\n\nInput image 1 is identity canon. Input image 2 is generated frame. Inspect actual pixels against direction and shot.\nDirection: ${direction}\nShot: ${JSON.stringify(shot)}\nCanon: ${JSON.stringify(canon)}\nReturn one line: ACCEPT reason; RETRY FRESH reason; RETRY EDIT shot_N reason; or STOP reason. Retry for identity drift, anatomy, continuity, text/logo, unclear story fact, undesirable product, or accidental gross/sexual reading. Change strategy when current reference geometry blocks required pose. STOP only when another strategy cannot plausibly help.`,
  });
}

async function contactSheet(frames: BoardFrame[], project: VideoProject, outputPath: string) {
  const cells = await Promise.all(frames.map(async (frame) => sharp(await readFile(media(project, frame.mediaId).path)).resize(360, 640, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer()));
  const width = cells.length === 1 ? 400 : 800;
  const rows = Math.ceil(cells.length / 2);
  await sharp({ create: { width, height: rows * 680, channels: 3, background: "#111111" } }).composite(cells.map((input, index) => ({ input, left: cells.length === 1 ? 20 : 20 + (index % 2) * 400, top: 20 + Math.floor(index / 2) * 680 }))).jpeg({ quality: 90 }).toFile(outputPath);
}

export async function createStoryboard({ project, ai, textModel, imageModel, planId, deliveryId, focus = "" }: { project: VideoProject; ai: GoogleGenAI; textModel: string; imageModel: string; planId: string; deliveryId: string; focus?: string }) {
  if (!project.canon) throw new Error("canon_missing");
  assertCurrentInputs(project, [["plan", planId], ["delivery", deliveryId]]);
  const plan = JSON.parse(artifact(project, planId, "plan").content) as ProductionPlan;
  const delivery = artifact(project, deliveryId, "delivery").content;
  const trace = await startTrace(project, { owner: "visual", operation: "create-storyboard", inputArtifactIds: [planId, deliveryId], models: [textModel, imageModel] });
  const temporary = await mkdtemp(path.join(project.outputDir, ".board-"));
  try {
    const source = await preparedImage(project.sourcePath);
    const previousBoardId = project.current.board;
    const previous = previousBoardId ? boardManifest(artifact(project, previousBoardId, "board").content) : undefined;
    const targeted = new Set(focus.match(/shot_\d+/g) ?? []);
    const regenerateAll = targeted.size === 0;
    const boardVersion = project.artifacts.filter((candidate) => candidate.slot === "board").length + 1;
    const outputDir = path.join(project.outputDir, "storyboard", `v${boardVersion}`);
    const frames: BoardFrame[] = [];
    const buffers = new Map<string, Buffer>();
    const pending: Array<{ mediaId: string; temporaryPath: string; finalPath: string; parentMediaId?: string }> = [];
    for (const [index, shot] of plan.shots.entries()) {
      const reusable = !regenerateAll && !targeted.has(shot.id) ? previous?.frames.find((frame) => frame.shotId === shot.id) : undefined;
      if (reusable) {
        frames.push(reusable);
        buffers.set(shot.id, await readFile(media(project, reusable.mediaId).path));
        continue;
      }
      let accepted: Buffer | undefined;
      let acceptedParentId: string | undefined;
      let verdict = "";
      let feedback = "";
      let choice = strategy(await chooseStrategy({ ai, model: textModel, shot, prior: plan.shots.slice(0, index).filter((candidate) => buffers.has(candidate.id)) }), buffers);
      while (!accepted) {
        const parent = choice.kind === "edit" ? buffers.get(choice.shotId) : undefined;
        const direction = await directFrame({ ai, model: textModel, source, parent, plan, shot, delivery, canon: project.canon, feedback });
        await reserveImageGeneration(project);
        const generationImages = shot.subjects.length ? (parent ? [source, parent] : [source]) : [];
        const generated = await geminiImage({ ai, model: imageModel, images: generationImages, prompt: `${await skill()}\n\n${direction}\n\nCreate one photorealistic 9:16 frame.${shot.subjects.length ? " Reference image 1 owns character_1 identity." : " No canonical subject appears."}${parent ? " Reference image 2 owns wardrobe and environment continuity, not pose or body support when this shot changes them." : ""} Output pixels only.` });
        verdict = await inspectFrame({ ai, model: textModel, frame: generated, source, direction, shot, canon: project.canon });
        if (/^ACCEPT\b/i.test(verdict)) { accepted = generated; acceptedParentId = choice.kind === "edit" ? choice.shotId : undefined; break; }
        if (/^STOP\b/i.test(verdict)) throw new Error(`visual_strategy_exhausted:${shot.id}:${verdict}`);
        choice = strategy(verdict, buffers);
        feedback = verdict.replace(/^RETRY\s+(?:FRESH|EDIT\s+shot_\d+)\b[:\s-]*/i, "").trim();
      }
      const fileName = `${String(index + 1).padStart(2, "0")}-${shot.id}.png`;
      const temporaryPath = path.join(temporary, fileName);
      const framePath = path.join(outputDir, fileName);
      await writeFile(temporaryPath, accepted);
      const mediaId = `frame_${shot.id}_v${boardVersion}`;
      pending.push({ mediaId, temporaryPath, finalPath: framePath, parentMediaId: acceptedParentId ? frames.find((frame) => frame.shotId === acceptedParentId)?.mediaId : undefined });
      const reason = verdict.replace(/^ACCEPT\b[:\s-]*/i, "").trim();
      frames.push({ shotId: shot.id, mediaId, reason });
      buffers.set(shot.id, accepted);
    }
    await mkdir(outputDir, { recursive: true });
    for (const item of pending) {
      await rename(item.temporaryPath, item.finalPath);
      await saveMedia(project, { id: item.mediaId, kind: "frame", path: item.finalPath, parentMediaId: item.parentMediaId });
    }
    const manifest: BoardManifest = { planId, deliveryId, frames };
    const created = await saveArtifact(project, { slot: "board", content: JSON.stringify(manifest, null, 2), inputArtifactIds: [planId, deliveryId], mediaIds: frames.map((frame) => frame.mediaId), extension: "json" });
    await contactSheet(frames, project, path.join(project.outputDir, `storyboard-contact-sheet-v${boardVersion}.jpg`));
    await finishTrace(project, trace, "accepted", `${frames.length} accepted frames.`, created.id);
    return created;
  } catch (error) {
    await finishTrace(project, trace, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function reviewVideoPayload({ project, ai, model, planId, boardId, deliveryId, prompt }: { project: VideoProject; ai: GoogleGenAI; model: string; planId: string; boardId: string; deliveryId: string; prompt: string }) {
  assertCurrentInputs(project, [["plan", planId], ["board", boardId], ["delivery", deliveryId]]);
  const board = boardManifest(artifact(project, boardId, "board").content);
  const images = await Promise.all(board.frames.map((frame) => preparedImage(media(project, frame.mediaId).path)));
  const verdict = await geminiText({ ai, model, images, temperature: 0.1, prompt: `${await skill()}\n\nReview final Seedance payload against accepted board frames. Confirm prompt preserves plan, exact delivery, identity, frame order, continuity, and no captions. First word ACCEPT or REJECT. Then one concise reason.\nPayload:\n${prompt}` });
  if (!/^ACCEPT\b/i.test(verdict)) throw new Error(`seedance_payload_rejected:${verdict}`);
  return verdict.replace(/^ACCEPT\b[:\s-]*/i, "").trim();
}
