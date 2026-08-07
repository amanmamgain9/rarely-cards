import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { FunctionCallingConfigMode, GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import sharp from "sharp";
import { preparedJpeg } from "./models/gemini.ts";
import { allowedActions, publicProjectState, saveProject, type LocalVideoProject } from "./state.ts";
import { setIdentityTool } from "./tools/set-identity.ts";
import { chooseDeliveryTool, designSequenceTool, lockHookTool, shapeContinuationTool, writeScriptTool } from "./tools/planning.ts";
import { renderStoryboardTool } from "./tools/render-storyboard.ts";

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
      subjectKind: { type: Type.STRING, description: "Short lowercase classification of the visible primary subject." },
      physicalDescription: { type: Type.STRING, description: "At most 8 words naming only uniquely distinguishing visible traits. No breed/category, clothing, pose, background, or lighting." },
      immutableTraits: { type: Type.ARRAY, items: { type: Type.STRING }, description: "At most 3 short uniquely distinguishing traits. No breed/category or scene details." },
    }, required: ["projectId", "subjectKind", "physicalDescription", "immutableTraits"] },
  },
  {
    name: "lock_hook",
    description: "Select compatible hook patterns with rotation, self-grill, and lock one exact 0–2 second hook.",
    parameters: { type: Type.OBJECT, properties: { projectId: { type: Type.STRING } }, required: ["projectId"] },
  },
  {
    name: "shape_continuation",
    description: "Answer only the causal questions needed to complete the locked hook and creator direction.",
    parameters: { type: Type.OBJECT, properties: { projectId: { type: Type.STRING }, hookVersion: { type: Type.NUMBER } }, required: ["projectId", "hookVersion"] },
  },
  {
    name: "choose_delivery",
    description: "Decide whether narrator, character, hybrid, or silence best serves the locked hook completion.",
    parameters: { type: Type.OBJECT, properties: { projectId: { type: Type.STRING }, continuationVersion: { type: Type.NUMBER } }, required: ["projectId", "continuationVersion"] },
  },
  {
    name: "write_script",
    description: "Write exact performance, dialogue, narration, and sound from locked hook, continuation, and delivery decision.",
    parameters: { type: Type.OBJECT, properties: { projectId: { type: Type.STRING }, deliveryVersion: { type: Type.NUMBER } }, required: ["projectId", "deliveryVersion"] },
  },
  {
    name: "design_sequence",
    description: "Turn locked hook completion and script into timed shots, B-roll, camera, text, and references.",
    parameters: { type: Type.OBJECT, properties: { projectId: { type: Type.STRING }, scriptVersion: { type: Type.NUMBER } }, required: ["projectId", "scriptVersion"] },
  },
  {
    name: "render_storyboard",
    description: "Render only the visual references required by the current plan.",
    parameters: { type: Type.OBJECT, properties: { projectId: { type: Type.STRING }, planVersion: { type: Type.NUMBER } }, required: ["projectId", "planVersion"] },
  },
];

export async function runLocalVideoAgent({ imagePath, request, outputDir, resume = false, stopAfter = "storyboard" }: {
  imagePath: string;
  request: string;
  outputDir: string;
  resume?: boolean;
  stopAfter?: "hook" | "storyboard";
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
        "Choose exactly one action from allowedActions. Call get_project_state only if state is missing or uncertain. For set_identity, classify subject kind internally, then describe identity in at most 8 words and at most 3 short uniquely distinguishing traits. Never name breed/category in the description; exclude clothing, props, pose, background, and lighting.",
        "When plan diagnostics exist, decide whether one redesign is worthwhile; otherwise render. After a failed tool, retry only when current state still allows it.",
        "Never skip versions, invent tools, call an illegal action, or request paid video generation.",
        stopAfter === "hook" ? "This run ends immediately after lock_hook succeeds. Do not call shape_continuation." : "Continue until storyboard review.",
        "When stage is review, report that the storyboard is ready, then stop.",
      ].join(" "),
      tools: [{ functionDeclarations }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      temperature: 0.1,
    },
  });

  let response = await chat.sendMessage({ message: [
    { text: `Creator request: ${JSON.stringify(request)}\nStop after: ${stopAfter}\nCurrent project state: ${JSON.stringify(publicProjectState(project))}` },
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
        const subjectKind = String(call.args.subjectKind).trim().toLowerCase();
        if (!/^[a-z0-9_-]{1,40}$/.test(subjectKind)) throw new Error("subject_kind_invalid");
        const physicalDescription = String(call.args.physicalDescription).trim();
        const immutableTraits = Array.isArray(call.args.immutableTraits) ? call.args.immutableTraits.map(String) : [];
        if (!physicalDescription || physicalDescription.split(/\s+/).length > 8 || immutableTraits.length > 3 || immutableTraits.some((trait) => trait.trim().length < 2 || trait.trim().length > 60)) throw new Error("identity_traits_invalid");
        result = await setIdentityTool(project, subjectKind, physicalDescription, immutableTraits);
      } else if (call.name === "lock_hook") result = await lockHookTool(project, ai, textModel, source);
      else if (call.name === "shape_continuation") {
        if (call.args.hookVersion !== project.versions.hook) throw new Error("hook_version_stale");
        result = await shapeContinuationTool(project, ai, textModel);
      }
      else if (call.name === "choose_delivery") {
        if (call.args.continuationVersion !== project.versions.continuation) throw new Error("continuation_version_stale");
        result = await chooseDeliveryTool(project, ai, textModel);
      }
      else if (call.name === "write_script") {
        if (call.args.deliveryVersion !== project.versions.delivery) throw new Error("delivery_version_stale");
        result = await writeScriptTool(project, ai, textModel);
      } else if (call.name === "design_sequence") {
        if (call.args.scriptVersion !== project.versions.script) throw new Error("script_version_stale");
        result = await designSequenceTool(project, ai, textModel, source);
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
    if (stopAfter === "hook" && project.stage === "hook_ready") break;
    response = await chat.sendMessage({ message: [{ functionResponse: { id: call.id, name: call.name, response: { output: result } } }] });
  }
  const expectedStage = stopAfter === "hook" ? "hook_ready" : "review";
  if (project.stage !== expectedStage) throw new Error(`agent_stopped_at_${project.stage}`);
  return {
    projectPath: path.join(resolvedOutputDir, "project.json"),
    hookPath: project.hookPath ?? null,
    contactSheetPath: stopAfter === "storyboard" ? path.join(resolvedOutputDir, "storyboard-contact-sheet.jpg") : null,
    frameCount: project.storyboard.length,
    finalAgentMessage: stopAfter === "hook" ? "Hook is ready for review." : response.text ?? "",
  };
}
