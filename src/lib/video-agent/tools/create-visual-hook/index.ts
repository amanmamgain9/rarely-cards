import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTextSession } from "../../runtime/session.ts";
import { assertCurrentInputs, type VideoProject } from "../../store/index.ts";
import { sampleHookTerritories } from "./catalog.ts";

const skillPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "SKILL.md");

export function createVisualHook(project: VideoProject, storyId: string, focus = "") {
  assertCurrentInputs(project, [["story", storyId]]);
  const sampleSeed = `${project.id}:${storyId}:${project.artifacts.filter((item) => item.slot === "hook").length + 1}`;
  return runTextSession({
    project, operation: "visual-hook", slot: "hook", skillPath, inputArtifactIds: [storyId], focus,
    tools: [
      {
        declaration: { name: "sample_hook_territories", description: "Return a varied deterministic sample of hook territories for this story version.", parameters: { type: "object", properties: {}, additionalProperties: false } },
        run: async () => JSON.stringify(sampleHookTerritories(sampleSeed)),
      },
    ],
  });
}
