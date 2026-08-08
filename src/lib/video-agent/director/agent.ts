import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FunctionCallingConfigMode, Type, type FunctionDeclaration, type GoogleGenAI, type Part } from "@google/genai";
import { videoTools, type VideoProject } from "../tools/index.ts";

const skillPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "SKILL.md");
export type StopAfter = "story" | "hook" | "delivery" | "plan" | "board";

const declarations: FunctionDeclaration[] = [
  { name: "read_artifact", description: "Read one artifact by ID. Board reads also show accepted frames.", parameters: { type: Type.OBJECT, properties: { artifactId: { type: Type.STRING } }, required: ["artifactId"] } },
  { name: "create_story", description: "Run funny-cute story session. Request is runtime-resolved; pass only optional retry focus.", parameters: { type: Type.OBJECT, properties: { focus: { type: Type.STRING } } } },
  { name: "create_visual_hook", description: "Run visual-hook session on current story.", parameters: { type: Type.OBJECT, properties: { storyId: { type: Type.STRING }, focus: { type: Type.STRING } }, required: ["storyId"] } },
  { name: "write_delivery", description: "Run delivery session on current story and hook.", parameters: { type: Type.OBJECT, properties: { storyId: { type: Type.STRING }, hookId: { type: Type.STRING }, focus: { type: Type.STRING } }, required: ["storyId", "hookId"] } },
  { name: "compile_video", description: "Run production-planning session on current story, hook, and delivery.", parameters: { type: Type.OBJECT, properties: { storyId: { type: Type.STRING }, hookId: { type: Type.STRING }, deliveryId: { type: Type.STRING }, focus: { type: Type.STRING } }, required: ["storyId", "hookId", "deliveryId"] } },
  { name: "create_storyboard", description: "Delegate plan and delivery to Visual Agent; returns one board artifact.", parameters: { type: Type.OBJECT, properties: { planId: { type: Type.STRING }, deliveryId: { type: Type.STRING }, focus: { type: Type.STRING } }, required: ["planId", "deliveryId"] } },
  { name: "finish_run", description: "Finish after reading and accepting target artifact.", parameters: { type: Type.OBJECT, properties: { artifactId: { type: Type.STRING }, summary: { type: Type.STRING } }, required: ["artifactId", "summary"] } },
];

export async function runDirector({ project, ai, textModel, imageModel, stopAfter }: { project: VideoProject; ai: GoogleGenAI; textModel: string; imageModel: string; stopAfter: StopAfter }) {
  const direction = await readFile(skillPath, "utf8");
  const tools = videoTools({ project, ai, textModel, imageModel });
  const readIds = new Set<string>();
  const chat = ai.chats.create({
    model: textModel,
    config: {
      systemInstruction: `${direction}\n\nExactly two agent roles exist: you are Director; Visual Agent owns pixels. Text tools birth private skill sessions. Tool arguments carry artifact IDs only, except retry focus. Choose one tool at a time. Stop at ${stopAfter}.`,
      tools: [{ functionDeclarations: declarations }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      temperature: 0.15,
    },
  });
  let response = await chat.sendMessage({ message: `Verbatim creator request:\n${project.request.text}\n\nArtifact index:\n${JSON.stringify(tools.index())}\n\nBuild through ${stopAfter}.` });
  for (let turn = 0; turn < 30; turn += 1) {
    const calls = response.functionCalls ?? [];
    if (calls.length === 0 && response.text?.trim()) return { kind: "escalated" as const, escalation: response.text.trim() };
    if (calls.length !== 1) throw new Error(calls.length ? "director_must_call_one_tool" : "director_stopped_without_finish");
    const call = calls[0];
    const args = (call.args ?? {}) as Record<string, unknown>;
    let result: unknown;
    const extra: Part[] = [];
    try {
      if (call.name === "read_artifact") {
        const item = tools.readArtifact(String(args.artifactId));
        readIds.add(item.id);
        result = { id: item.id, slot: item.slot, version: item.version, inputArtifactIds: item.inputArtifactIds, content: item.content };
        if (item.slot === "board") {
          for (const frame of await tools.readBoardFrames(item.id)) {
            extra.push({ text: `${frame.id}: accepted board frame.` }, { inlineData: { mimeType: "image/png", data: frame.data } });
          }
        }
      } else if (call.name === "create_story") {
        const item = await tools.createStory(String(args.focus ?? "")); result = { artifactId: item.id, slot: item.slot, current: tools.index().current };
      } else if (call.name === "create_visual_hook") {
        const item = await tools.createVisualHook(String(args.storyId), String(args.focus ?? "")); result = { artifactId: item.id, slot: item.slot, current: tools.index().current };
      } else if (call.name === "write_delivery") {
        const item = await tools.writeDelivery(String(args.storyId), String(args.hookId), String(args.focus ?? "")); result = { artifactId: item.id, slot: item.slot, current: tools.index().current };
      } else if (call.name === "compile_video") {
        const item = await tools.compileVideo(String(args.storyId), String(args.hookId), String(args.deliveryId), String(args.focus ?? "")); result = { artifactId: item.id, slot: item.slot, current: tools.index().current };
      } else if (call.name === "create_storyboard") {
        const item = await tools.createStoryboard(String(args.planId), String(args.deliveryId), String(args.focus ?? "")); result = { artifactId: item.id, slot: item.slot, current: tools.index().current };
      } else if (call.name === "finish_run") {
        const id = String(args.artifactId);
        const target = tools.finishTarget(id, stopAfter, readIds);
        return { kind: "accepted" as const, artifact: target, summary: String(args.summary) };
      } else throw new Error(`unknown_director_tool:${call.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (call.name === "create_storyboard" && /^(visual_strategy_exhausted|image_budget_exhausted):?/.test(message)) return { kind: "escalated" as const, escalation: `Storyboard stopped before Seedance: ${message}` };
      result = { error: message, current: tools.index().current };
    }
    response = await chat.sendMessage({ message: [{ functionResponse: { id: call.id, name: call.name!, response: { result } } }, ...extra] });
  }
  throw new Error("director_turn_budget_exhausted");
}
