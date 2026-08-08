import path from "node:path";
import { fileURLToPath } from "node:url";
import { Type, type GoogleGenAI } from "@google/genai";
import { runTextSession } from "../../runtime/session.ts";
import { assertCurrentInputs, type VideoProject } from "../../store/index.ts";
import { visualConceptVerdict } from "../../visual/agent.ts";
import { sampleHookTerritories } from "./catalog.ts";

const skillPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "SKILL.md");

export function createVisualHook(project: VideoProject, ai: GoogleGenAI, model: string, storyId: string, focus = "") {
  assertCurrentInputs(project, [["story", storyId]]);
  const sampleSeed = `${project.id}:${storyId}:${project.artifacts.filter((item) => item.slot === "hook").length + 1}`;
  return runTextSession({
    project, ai, model, operation: "visual-hook", slot: "hook", skillPath, inputArtifactIds: [storyId], focus,
    tools: [
      {
        declaration: { name: "sample_hook_territories", description: "Return a varied deterministic sample of hook territories for this story version.", parameters: { type: Type.OBJECT, properties: {} } },
        run: async () => JSON.stringify(sampleHookTerritories(sampleSeed)),
      },
      {
        declaration: { name: "ask_visual_agent", description: "Ask Visual Agent for a text-only verdict on readability or accidental visual meaning.", parameters: { type: Type.OBJECT, properties: { concept: { type: Type.STRING }, question: { type: Type.STRING } }, required: ["concept", "question"] } },
        run: async ({ concept, question }) => visualConceptVerdict({ project, ai, model, concept: String(concept), question: String(question) }),
      },
    ],
  });
}
