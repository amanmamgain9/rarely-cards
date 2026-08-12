import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { artifact, assertCurrentInputs, consumeSpendGrant, finishTrace, saveArtifact, startTrace, type VideoProject } from "../../store/index.ts";
import { parseProductionPlan } from "../compile-video/schema.ts";
import { createSeedanceVideo } from "../../video_models/seedance.ts";
import { buildVideoPrompt } from "./payload.ts";

export async function generateVideo({ project, planId, deliveryId, spendGrantId, userId, generationId }: { project: VideoProject; planId: string; deliveryId: string; spendGrantId: string; userId: string; generationId: string }) {
  assertCurrentInputs(project, [["plan", planId], ["delivery", deliveryId]]);
  const trace = await startTrace(project, { owner: "tool", operation: "generate-video", inputArtifactIds: [planId, deliveryId], models: ["seedance"] });
  try {
    const plan = parseProductionPlan(artifact(project, planId, "plan").content);
    const prompt = buildVideoPrompt(project, planId, deliveryId);
    if (!project.canon) throw new Error("canon_missing");
    const references = await Promise.all(project.canon.references.map(async (reference) => {
      const source = await readFile(reference.path);
      const format = (await sharp(source).metadata()).format;
      const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
      return { type: "image" as const, url: `data:${mime};base64,${source.toString("base64")}` };
    }));
    await consumeSpendGrant(project, spendGrantId);
    const taskId = await createSeedanceVideo({
      prompt,
      references,
      durationSeconds: plan.durationSeconds,
      resolution: "1080p",
      ratio: "9:16",
      generateAudio: true,
      watermark: false,
      userId,
      generationId,
    });
    const created = await saveArtifact(project, { slot: "video", content: JSON.stringify({ taskId, status: "submitted", generationId }, null, 2), inputArtifactIds: [planId, deliveryId], extension: "json" });
    await finishTrace(project, trace, "accepted", `${references.length} mapped references and text plan submitted to Seedance.`, created.id);
    return created;
  } catch (error) {
    await finishTrace(project, trace, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
