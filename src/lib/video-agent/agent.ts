import { readFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { runDirector, type StopAfter } from "./director/agent.ts";
import { createProject, currentArtifact, loadProject, recoverInterruptedTraces, saveProject, type VideoProject } from "./store/index.ts";
import { createSubjectCanon } from "./visual/agent.ts";

type LegacyStopAfter = StopAfter | "seedance" | "storyboard";

export async function runLocalVideoAgent({ imagePath, request, outputDir, resume = false, stopAfter = "board" }: { imagePath: string; request: string; outputDir: string; resume?: boolean; stopAfter?: LegacyStopAfter }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  const textModel = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  const imageModel = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image";
  const sourcePath = path.resolve(imagePath);
  const resolvedOutputDir = path.resolve(outputDir);
  const creatorRequest = request.trim();
  const metadata = await sharp(await readFile(sourcePath)).rotate().metadata();
  if (!metadata.width || !metadata.height || !creatorRequest) throw new Error("project_input_invalid");
  let project: VideoProject;
  if (resume) {
    project = await loadProject(resolvedOutputDir);
    if (path.resolve(project.sourcePath) !== sourcePath || project.request.text !== creatorRequest || path.resolve(project.outputDir) !== resolvedOutputDir) throw new Error("resume_input_mismatch");
    recoverInterruptedTraces(project);
    await saveProject(project);
  } else {
    project = await createProject({ outputDir: resolvedOutputDir, sourcePath, request: creatorRequest });
  }
  const ai = new GoogleGenAI({ apiKey });
  if (!project.canon) await createSubjectCanon({ project, ai, model: textModel });
  const target: StopAfter = stopAfter === "seedance" ? "plan" : stopAfter === "storyboard" ? "board" : stopAfter;
  const result = await runDirector({ project, ai, textModel, imageModel, stopAfter: target });
  const hook = project.current.hook ? currentArtifact(project, "hook") : undefined;
  const board = project.current.board ? currentArtifact(project, "board") : undefined;
  if (result.kind === "escalated") return {
    projectPath: path.join(resolvedOutputDir, "project.json"), artifactId: null, artifactPath: null,
    hookPath: hook?.path ?? null, contactSheetPath: null, frameCount: 0,
    creativeArtifactPaths: project.artifacts.filter((item) => ["story", "hook", "delivery"].includes(item.slot)).map((item) => item.path),
    finalAgentMessage: result.escalation,
  };
  const seedancePromptPath = board ? await (await import("./tools/generate-video/payload.ts")).saveVideoPrompt(project, currentArtifact(project, "plan").id, board.id, currentArtifact(project, "delivery").id) : null;
  return {
    projectPath: path.join(resolvedOutputDir, "project.json"),
    artifactId: result.artifact.id,
    artifactPath: result.artifact.path,
    hookPath: hook?.path ?? null,
    contactSheetPath: board ? path.join(resolvedOutputDir, `storyboard-contact-sheet-v${board.version}.jpg`) : null,
    seedancePromptPath,
    frameCount: board?.mediaIds?.length ?? 0,
    creativeArtifactPaths: project.artifacts.filter((item) => ["story", "hook", "delivery"].includes(item.slot)).map((item) => item.path),
    finalAgentMessage: result.summary,
  };
}
