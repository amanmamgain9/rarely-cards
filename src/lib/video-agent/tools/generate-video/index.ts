import { readFile } from "node:fs/promises";
import type { GoogleGenAI } from "@google/genai";
import { artifact, assertCurrentInputs, consumeSpendGrant, finishTrace, media, saveArtifact, startTrace, type VideoProject } from "../../store/index.ts";
import { parseProductionPlan } from "../compile-video/schema.ts";
import { reviewVideoPayload } from "../../visual/agent.ts";
import { createSeedanceVideo } from "../../video_models/seedance.ts";
import { buildVideoPrompt } from "./payload.ts";

type BoardManifest = { frames: Array<{ shotId: string; mediaId: string; reason: string }> };

export async function generateVideo({ project, ai, reviewModel, planId, boardId, deliveryId, spendGrantId, userId, generationId }: { project: VideoProject; ai: GoogleGenAI; reviewModel: string; planId: string; boardId: string; deliveryId: string; spendGrantId: string; userId: string; generationId: string }) {
  assertCurrentInputs(project, [["plan", planId], ["board", boardId], ["delivery", deliveryId]]);
  const trace = await startTrace(project, { owner: "tool", operation: "generate-video", inputArtifactIds: [planId, boardId, deliveryId], models: [reviewModel, "seedance"] });
  try {
    const plan = parseProductionPlan(artifact(project, planId, "plan").content);
    const board = JSON.parse(artifact(project, boardId, "board").content) as BoardManifest;
    const prompt = buildVideoPrompt(project, planId, boardId, deliveryId);
    await reviewVideoPayload({ project, ai, model: reviewModel, planId, boardId, deliveryId, prompt });
    const references = await Promise.all(board.frames.map(async (frame) => ({ type: "image" as const, url: `data:image/png;base64,${(await readFile(media(project, frame.mediaId).path)).toString("base64")}` })));
    await consumeSpendGrant(project, spendGrantId);
    const taskId = await createSeedanceVideo({ prompt, references, durationSeconds: plan.durationSeconds, resolution: "1080p", ratio: "9:16", generateAudio: true, watermark: false, userId, generationId });
    const created = await saveArtifact(project, { slot: "video", content: JSON.stringify({ taskId, status: "submitted", generationId }, null, 2), inputArtifactIds: [planId, boardId, deliveryId], extension: "json" });
    await finishTrace(project, trace, "accepted", "Payload approved and submitted to Seedance.", created.id);
    return created;
  } catch (error) {
    await finishTrace(project, trace, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
