import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deepSeekChat, toolArguments, type DeepSeekMessage, type DeepSeekTool } from "../providers/deepseek.ts";
import { videoTools, type VideoProject } from "../tools/index.ts";

const skillPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "SKILL.md");
export type StopAfter = "story" | "hook" | "delivery" | "plan";

const declarations: DeepSeekTool[] = [
  { name: "read_artifact", description: "Read one artifact by ID.", parameters: { type: "object", properties: { artifactId: { type: "string" } }, required: ["artifactId"], additionalProperties: false } },
  { name: "create_story", description: "Run funny-cute story session. Request is runtime-resolved; pass only optional retry focus.", parameters: { type: "object", properties: { focus: { type: "string" } }, additionalProperties: false } },
  { name: "create_visual_hook", description: "Run visual-hook session on current story.", parameters: { type: "object", properties: { storyId: { type: "string" }, focus: { type: "string" } }, required: ["storyId"], additionalProperties: false } },
  { name: "write_delivery", description: "Run delivery session on current story and hook.", parameters: { type: "object", properties: { storyId: { type: "string" }, hookId: { type: "string" }, focus: { type: "string" } }, required: ["storyId", "hookId"], additionalProperties: false } },
  { name: "compile_video", description: "Run production-planning session on current story, hook, and delivery.", parameters: { type: "object", properties: { storyId: { type: "string" }, hookId: { type: "string" }, deliveryId: { type: "string" }, focus: { type: "string" } }, required: ["storyId", "hookId", "deliveryId"], additionalProperties: false } },
];

export async function runDirector({ project, stopAfter }: { project: VideoProject; stopAfter: StopAfter }) {
  const direction = await readFile(skillPath, "utf8");
  const tools = videoTools({ project });
  const readIds = new Set<string>();
  const messages: DeepSeekMessage[] = [
    {
      role: "system",
      content: `${direction}\n\nYou are Director. Specialist text tools own authorship. Tool arguments carry artifact IDs only, except retry focus. Use tools while work remains. After reading and accepting the current ${stopAfter} artifact, stop calling tools and return one concise completion summary.`,
    },
    {
      role: "user",
      content: `Verbatim creator request:\n${project.request.text}\n\nSubject canon:\n${JSON.stringify(project.canon)}\n\nArtifact index:\n${JSON.stringify(tools.index())}\n\nBuild through ${stopAfter}.`,
    },
  ];
  for (let turn = 0; turn < 30; turn += 1) {
    const response = await deepSeekChat({ messages, tools: declarations, thinking: false });
    messages.push(response);
    const calls = response.tool_calls ?? [];
    if (!calls.length) {
      const summary = response.content?.trim();
      const targetId = project.current[stopAfter];
      try {
        if (!summary) throw new Error("director_summary_empty");
        if (summary.length > 800) throw new Error("director_summary_too_long");
        if (!targetId) throw new Error(`current_artifact_missing:${stopAfter}`);
        const target = tools.finishTarget(targetId, stopAfter, readIds);
        return { kind: "accepted" as const, artifact: target, summary };
      } catch (error) {
        messages.push({ role: "user", content: `Cannot finish: ${error instanceof Error ? error.message : String(error)}. Continue with tools.` });
        continue;
      }
    }
    for (const call of calls) {
      let result: unknown;
      try {
        const args = toolArguments(call);
        if (call.function.name === "read_artifact") {
          const item = tools.readArtifact(String(args.artifactId));
          readIds.add(item.id);
          result = { id: item.id, slot: item.slot, version: item.version, inputArtifactIds: item.inputArtifactIds, content: item.content };
        } else if (call.function.name === "create_story") {
          const item = await tools.createStory(String(args.focus ?? "")); result = { artifactId: item.id, slot: item.slot, current: tools.index().current };
        } else if (call.function.name === "create_visual_hook") {
          const item = await tools.createVisualHook(String(args.storyId), String(args.focus ?? "")); result = { artifactId: item.id, slot: item.slot, current: tools.index().current };
        } else if (call.function.name === "write_delivery") {
          const item = await tools.writeDelivery(String(args.storyId), String(args.hookId), String(args.focus ?? "")); result = { artifactId: item.id, slot: item.slot, current: tools.index().current };
        } else if (call.function.name === "compile_video") {
          const item = await tools.compileVideo(String(args.storyId), String(args.hookId), String(args.deliveryId), String(args.focus ?? "")); result = { artifactId: item.id, slot: item.slot, current: tools.index().current };
        } else throw new Error(`unknown_director_tool:${call.function.name}`);
      } catch (error) {
        result = { error: error instanceof Error ? error.message : String(error), current: tools.index().current };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new Error("director_turn_budget_exhausted");
}
