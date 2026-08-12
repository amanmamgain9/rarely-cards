import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTextSession } from "../../runtime/session.ts";
import type { VideoProject } from "../../store/index.ts";

const skillPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "SKILL.md");

export function createStory(project: VideoProject, focus = "") {
  return runTextSession({ project, operation: "funny-cute-story", slot: "story", skillPath, inputArtifactIds: [], focus, includeRequest: true });
}
