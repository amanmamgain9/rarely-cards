import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { FunctionCallingConfigMode, GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import sharp from "sharp";
import { preparedJpeg } from "./model.ts";
import { allowedActions, publicProjectState, saveProject, type LocalVideoProject } from "./project.ts";
import { exportSeedancePackage } from "./seedance-package.ts";
import { setIdentityTool } from "./tools/identity.ts";
import { createHookTool, designVideoTool, writeVideoTool } from "./tools/planning.ts";
import { renderStoryboardTool } from "./tools/storyboard.ts";

const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "get_project_state",
    description: "Read canonical project state and currently legal actions.",
    parameters: { type: Type.OBJECT, properties: { projectId: { type: Type.STRING } }, required: ["projectId"] },
  },
  {
    name: "set_identity",
    description: "Classify the visible primary subject and register the uploaded photo as its canonical identity reference.",
    parameters: { type: Type.OBJECT, properties: {
      projectId: { type: Type.STRING },
      subjectKind: { type: Type.STRING, enum: ["pet", "person", "product", "other"] },
    }, required: ["projectId", "subjectKind"] },
  },
  {
    name: "create_hook",
    description: "Lock the first 0–2 seconds and its story obligation.",
    parameters: { type: Type.OBJECT, properties: { projectId: { type: Type.STRING } }, required: ["projectId"] },
  },
  {
    name: "write_video",
    description: "Expand the locked hook into a complete short treatment with exact speech.",
    parameters: { type: Type.OBJECT, properties: { projectId: { type: Type.STRING }, hookVersion: { type: Type.NUMBER } }, required: ["projectId", "hookVersion"] },
  },
  {
    name: "design_video",
    description: "Turn the treatment into a feasible timed multi-reference production plan.",
    parameters: { type: Type.OBJECT, properties: { projectId: { type: Type.STRING }, treatmentVersion: { type: Type.NUMBER } }, required: ["projectId", "treatmentVersion"] },
  },
  {
    name: "render_storyboard",
    description: "Render only the visual references required by the current plan.",
    parameters: { type: Type.OBJECT, properties: { projectId: { type: Type.STRING }, planVersion: { type: Type.NUMBER } }, required: ["projectId", "planVersion"] },
  },
];

export async function runLocalVideoAgent({ imagePath, request, outputDir, resume = false }: {
  imagePath: string;
  request: string;
  outputDir: string;
  resume?: boolean;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  const textModel = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  const imageModel = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image";
  const resolvedImagePath = path.resolve(imagePath);
  const resolvedOutputDir = path.resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });
  const metadata = await sharp(await readFile(resolvedImagePath)).rotate().metadata();
  if (!metadata.width || !metadata.height) throw new Error("source_image_invalid");
  const source = await preparedJpeg(resolvedImagePath);
  const project = resume
    ? JSON.parse(await readFile(path.join(resolvedOutputDir, "project.json"), "utf8")) as LocalVideoProject
    : {
      id: randomUUID(), request: request.trim(), sourcePath: resolvedImagePath,
      sourceSummary: `${metadata.width}x${metadata.height} ${metadata.format || "image"}`,
      outputDir: resolvedOutputDir, stage: "collecting", versions: {}, characters: [], referenceAssets: [], storyboard: [], runs: [], agentLog: [],
    } satisfies LocalVideoProject;
  if (path.resolve(project.sourcePath) !== resolvedImagePath || project.request !== request.trim() || path.resolve(project.outputDir) !== resolvedOutputDir) {
    throw new Error("resume_input_mismatch");
  }
  if (resume) {
    const interruptedAt = new Date().toISOString();
    for (const run of project.runs.filter((candidate) => candidate.status === "running")) {
      run.status = "failed";
      run.completedAt = interruptedAt;
      run.error = "run_interrupted";
    }
    if (project.stage === "storyboard_rendering") project.stage = "planned";
  }
  await saveProject(project);

  const ai = new GoogleGenAI({ apiKey });
  const chat = ai.chats.create({
    model: textModel,
    config: {
      systemInstruction: [
        "You coordinate a bounded local video workflow.",
        "Choose exactly one action from allowedActions. Call get_project_state only if state is missing or uncertain. For set_identity, inspect the uploaded image and classify its primary subject.",
        "When plan diagnostics exist, decide whether one redesign is worthwhile; otherwise render. After a failed tool, retry only when current state still allows it.",
        "Never skip versions, invent tools, call an illegal action, or request paid video generation.",
        "When stage is review, report that storyboard and Seedance package are ready, then stop.",
      ].join(" "),
      tools: [{ functionDeclarations }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      temperature: 0.1,
    },
  });

  let response = await chat.sendMessage({ message: [
    { text: `Creator request: ${JSON.stringify(request)}\nCurrent project state: ${JSON.stringify(publicProjectState(project))}` },
    { inlineData: { mimeType: "image/jpeg", data: source.toString("base64") } },
  ] });
  for (let turn = 0; turn < 12; turn += 1) {
    const calls = response.functionCalls ?? [];
    project.agentLog.push({ at: new Date().toISOString(), text: response.text ?? "", functionCalls: calls });
    await saveProject(project);
    if (calls.length === 0) break;
    if (calls.length !== 1) throw new Error("agent_must_call_one_tool_at_a_time");
    const call = calls[0];
    if (!call.name || call.args?.projectId !== project.id) throw new Error("agent_tool_arguments_invalid");
    process.stdout.write(`Agent chose ${call.name}\n`);
    let result: unknown;
    try {
      if (call.name !== "get_project_state" && !allowedActions(project).includes(call.name as never)) throw new Error(`agent_tool_not_allowed:${call.name}`);
      if (call.name === "get_project_state") result = publicProjectState(project);
      else if (call.name === "set_identity") {
        const subjectKind = String(call.args.subjectKind);
        if (!["pet", "person", "product", "other"].includes(subjectKind)) throw new Error("subject_kind_invalid");
        result = await setIdentityTool(project, subjectKind as "pet" | "person" | "product" | "other");
      } else if (call.name === "create_hook") result = await createHookTool(project, ai, textModel, source);
      else if (call.name === "write_video") {
        if (call.args.hookVersion !== project.versions.hook) throw new Error("hook_version_stale");
        result = await writeVideoTool(project, ai, textModel);
      } else if (call.name === "design_video") {
        if (call.args.treatmentVersion !== project.versions.treatment) throw new Error("treatment_version_stale");
        result = await designVideoTool(project, ai, textModel, source);
      } else if (call.name === "render_storyboard") {
        result = await renderStoryboardTool(project, ai, imageModel, source, Number(call.args.planVersion));
      } else throw new Error(`unknown_agent_tool:${call.name}`);
    } catch (error) {
      result = {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        state: publicProjectState(project),
      };
    }
    project.agentLog.push({ at: new Date().toISOString(), tool: call.name, result });
    await saveProject(project);
    response = await chat.sendMessage({ message: [{ functionResponse: { id: call.id, name: call.name, response: { output: result } } }] });
  }
  if (project.stage !== "review") throw new Error(`agent_stopped_at_${project.stage}`);
  await exportSeedancePackage(project);
  await saveProject(project);
  return {
    projectPath: path.join(resolvedOutputDir, "project.json"),
    contactSheetPath: path.join(resolvedOutputDir, "storyboard-contact-sheet.jpg"),
    seedancePromptPath: path.join(resolvedOutputDir, "seedance-prompt.txt"),
    seedanceManifestPath: path.join(resolvedOutputDir, "seedance-manifest.json"),
    frameCount: project.storyboard.length,
    finalAgentMessage: response.text ?? "",
  };
}
