import { readFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { runDirector, type StopAfter } from "./director/agent.ts";
import { createProject, currentArtifact, loadProject, recoverInterruptedTraces, saveProject, type ProjectReferenceInput, type VideoProject } from "./store/index.ts";
import { createSubjectCanon, generateProjectReferences } from "./visual/agent.ts";

type LegacyStopAfter = StopAfter | "seedance";

export async function runLocalVideoAgent({ references, request, outputDir, resume = false, stopAfter = "plan" }: { references: ProjectReferenceInput[]; request: string; outputDir: string; resume?: boolean; stopAfter?: LegacyStopAfter }) {
  if (!process.env.DEEPSEEK_API_KEY?.trim()) throw new Error("DEEPSEEK_API_KEY is missing.");
  const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  const geminiImageModel = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image";
  const target: StopAfter = stopAfter === "seedance" ? "plan" : stopAfter;
  const resolvedOutputDir = path.resolve(outputDir);
  const creatorRequest = request.trim();
  const resolvedReferences = references.map((reference) => ({ ...reference, path: path.resolve(reference.path) }));
  if (!creatorRequest || !resolvedReferences.some(({ role }) => role === "character")) throw new Error("project_input_invalid");
  for (const reference of resolvedReferences) {
    const metadata = await sharp(await readFile(reference.path)).rotate().metadata();
    if (!metadata.width || !metadata.height) throw new Error(`reference_image_invalid:${reference.path}`);
  }
  let project: VideoProject;
  if (resume) {
    project = await loadProject(resolvedOutputDir);
    const hasInputs = resolvedReferences.every((input) => project.referenceInputs.some((saved) => path.resolve(saved.path) === input.path && saved.role === input.role && saved.description === input.description));
    if (!hasInputs || project.request.text !== creatorRequest || path.resolve(project.outputDir) !== resolvedOutputDir) throw new Error("resume_input_mismatch");
    recoverInterruptedTraces(project);
    await saveProject(project);
  } else {
    project = await createProject({ outputDir: resolvedOutputDir, referenceInputs: resolvedReferences, request: creatorRequest });
  }
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) throw new Error("GEMINI_API_KEY is missing.");
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  if (!project.canon) {
    await createSubjectCanon({ project, ai, model: geminiModel });
  }
  const existing = resume && project.current[target] ? currentArtifact(project, target) : undefined;
  const result = existing
    ? { artifact: existing, summary: `Resumed from accepted ${existing.id}.` }
    : await runDirector({ project, stopAfter: target });
  const planId = project.current.plan;
  const referencesChosen = planId && project.traces.some((trace) => trace.operation === "generate-project-references" && trace.status === "accepted" && trace.inputArtifactIds.includes(planId));
  if (planId && !referencesChosen) await generateProjectReferences({ project, ai, imageModel: geminiImageModel, reviewModel: geminiModel });
  const hook = project.current.hook ? currentArtifact(project, "hook") : undefined;
  const seedancePromptPath = project.current.plan && project.current.delivery
    ? await (await import("./tools/generate-video/payload.ts")).saveVideoPrompt(project, currentArtifact(project, "plan").id, currentArtifact(project, "delivery").id)
    : null;
  return {
    projectPath: path.join(resolvedOutputDir, "project.json"),
    artifactId: result.artifact.id,
    artifactPath: result.artifact.path,
    hookPath: hook?.path ?? null,
    contactSheetPath: null,
    seedancePromptPath,
    frameCount: 0,
    creativeArtifactPaths: project.artifacts.filter((item) => ["story", "hook", "delivery"].includes(item.slot)).map((item) => item.path),
    finalAgentMessage: result.summary,
  };
}
