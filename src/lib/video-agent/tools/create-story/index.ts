import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GoogleGenAI } from "@google/genai";
import { runTextSession } from "../../runtime/session.ts";
import type { VideoProject } from "../../store/index.ts";

const skillPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "SKILL.md");

export function createStory(project: VideoProject, ai: GoogleGenAI, model: string, focus = "") {
  return runTextSession({ project, ai, model, operation: "funny-cute-story", slot: "story", skillPath, inputArtifactIds: [], focus, includeRequest: true });
}
