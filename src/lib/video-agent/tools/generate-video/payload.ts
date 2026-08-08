import { writeFile } from "node:fs/promises";
import path from "node:path";
import { artifact, type VideoProject } from "../../store/index.ts";
import { parseProductionPlan } from "../compile-video/schema.ts";

type Board = { frames: Array<{ shotId: string; mediaId: string }> };

export function buildVideoPrompt(project: VideoProject, planId: string, boardId: string, deliveryId: string) {
  const plan = parseProductionPlan(artifact(project, planId, "plan").content);
  const board = JSON.parse(artifact(project, boardId, "board").content) as Board;
  const delivery = artifact(project, deliveryId, "delivery").content;
  return [
    `Create one ${plan.durationSeconds}-second vertical 9:16 video with generated audio.`,
    `Accepted reference frames appear in shot order: ${board.frames.map((frame) => `${frame.shotId}=@${frame.mediaId}`).join(", ")}.`,
    "PRODUCTION PLAN", JSON.stringify(plan, null, 2), "EXACT DELIVERY", delivery,
    "Preserve accepted identities, wardrobe, props, environments, composition intent, shot order, and voice identity. Speak supplied lines exactly once. Add no plot or speech. No captions, subtitles, titles, logos, watermarks, or visible writing.",
  ].join("\n\n");
}

export async function saveVideoPrompt(project: VideoProject, planId: string, boardId: string, deliveryId: string) {
  const outputPath = path.join(project.outputDir, "seedance-prompt.txt");
  await writeFile(outputPath, `${buildVideoPrompt(project, planId, boardId, deliveryId)}\n`);
  return outputPath;
}
