import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GoogleGenAI } from "@google/genai";
import { runTextSession } from "../../runtime/session.ts";
import { assertCurrentInputs, type VideoProject } from "../../store/index.ts";

const skillPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "SKILL.md");

export function writeDelivery(project: VideoProject, ai: GoogleGenAI, model: string, storyId: string, hookId: string, focus = "") {
  assertCurrentInputs(project, [["story", storyId], ["hook", hookId]]);
  return runTextSession({ project, ai, model, operation: "delivery-writing", slot: "delivery", skillPath, inputArtifactIds: [storyId, hookId], focus });
}
