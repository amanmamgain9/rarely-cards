import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GoogleGenAI } from "@google/genai";
import { runTextSession } from "../../runtime/session.ts";
import { assertCurrentInputs, type VideoProject } from "../../store/index.ts";
import { parseProductionPlan, productionPlanJsonSchema, validatePlanCanon } from "./schema.ts";

const skillPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "SKILL.md");

export function compileVideo(project: VideoProject, ai: GoogleGenAI, model: string, storyId: string, hookId: string, deliveryId: string, focus = "") {
  assertCurrentInputs(project, [["story", storyId], ["hook", hookId], ["delivery", deliveryId]]);
  return runTextSession({
    project, ai, model, operation: "production-planning", slot: "plan", skillPath, inputArtifactIds: [storyId, hookId, deliveryId], focus,
    prepareContent: (raw) => JSON.stringify(validatePlanCanon(parseProductionPlan(raw), project.canon!), null, 2),
    sessionContext: `Required provider JSON Schema:\n${JSON.stringify(productionPlanJsonSchema)}`,
    tools: [],
    maxCalls: 4,
  });
}

export function productionSchemaForPrompt() {
  return JSON.stringify(productionPlanJsonSchema);
}
