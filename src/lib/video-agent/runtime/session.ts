import { readFile } from "node:fs/promises";
import { FunctionCallingConfigMode, Type, type FunctionDeclaration, type GoogleGenAI } from "@google/genai";
import { qwenGeneration } from "../providers/qwen.ts";
import { artifact, finishTrace, saveArtifact, startTrace, type ArtifactSlot, type VideoProject } from "../store/index.ts";

type SessionTool = {
  declaration: FunctionDeclaration;
  run: (args: Record<string, unknown>) => Promise<string>;
};

export async function runTextSession({
  project, ai, model, operation, slot, skillPath, inputArtifactIds, focus = "", includeRequest = false, tools = [], maxCalls = 5,
  prepareContent, sessionContext = "",
}: {
  project: VideoProject;
  ai: GoogleGenAI;
  model: string;
  operation: string;
  slot: Exclude<ArtifactSlot, "board" | "video">;
  skillPath: string;
  inputArtifactIds: string[];
  focus?: string;
  includeRequest?: boolean;
  tools?: SessionTool[];
  maxCalls?: number;
  prepareContent?: (content: string) => string;
  sessionContext?: string;
}) {
  if (!project.canon) throw new Error("canon_missing");
  if (focus.length > 500) throw new Error("focus_too_long");
  const inputs = inputArtifactIds.map((id) => artifact(project, id));
  const skill = await readFile(skillPath, "utf8");
  const models = [model];
  const trace = await startTrace(project, { owner: "session", operation, inputArtifactIds, models });
  const finishDeclaration: FunctionDeclaration = {
    name: "finish_artifact",
    description: "Finish session with one final artifact. Call only when work satisfies skill and inputs.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING, description: "Complete final artifact in format required by loaded skill." },
        reason: { type: Type.STRING, description: "One concise reason this artifact is ready." },
      },
      required: ["content", "reason"],
    },
  };
  const qwenTool: SessionTool = {
    declaration: {
      name: "draft_with_qwen",
      description: "Ask a second writing model for a private draft or alternative. Result remains inside this session.",
      parameters: { type: Type.OBJECT, properties: { brief: { type: Type.STRING } }, required: ["brief"] },
    },
    run: async ({ brief }) => {
      models.push("qwen/qwen3-235b-a22b-instruct-2507");
      return qwenGeneration(`${skill}\n\nSession brief: ${String(brief)}\n\nInputs:\n${inputs.map((input) => input.content).join("\n\n")}\n\nReturn one private draft, no JSON.`);
    },
  };
  const sessionTools = [...(process.env.REPLICATE_API_TOKEN?.trim() ? [qwenTool] : []), ...tools];
  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: [
        "You own this creative session: assemble context, use private tools when useful, judge your work, and decide when to stop.",
        "Follow loaded skill. Inputs are locked upstream artifacts. Do not alter their decisions unless skill explicitly owns that decision.",
        "Drafts and tool results are private. Only finish_artifact survives. Never return JSON unless loaded skill is production planning.",
        "Call finish_artifact exactly once when ready. Do not explain work outside tool calls.",
      ].join(" "),
      tools: [{ functionDeclarations: [finishDeclaration, ...sessionTools.map((tool) => tool.declaration)] }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      temperature: 0.8,
    },
  });
  const context = [
    `# Loaded skill\n${skill}`,
    includeRequest ? `# Verbatim creator request\n${project.request.text}` : "",
    `# Subject canon\n${JSON.stringify(project.canon, null, 2)}`,
    sessionContext ? `# Session boundary\n${sessionContext}` : "",
    ...inputs.map((input) => `# Input artifact ${input.id}\n${input.content}`),
    focus ? `# Retry focus\n${focus}` : "",
  ].filter(Boolean).join("\n\n");
  try {
    let response = await chat.sendMessage({ message: context });
    for (let turn = 0; turn < maxCalls; turn += 1) {
      const calls = response.functionCalls ?? [];
      if (calls.length !== 1) throw new Error(calls.length ? "session_must_call_one_tool" : "session_finished_without_artifact");
      const call = calls[0];
      if (call.name === "finish_artifact") {
        const content = String(call.args?.content ?? "").trim();
        const reason = String(call.args?.reason ?? "").trim();
        try {
          if (!content || !reason) throw new Error("session_artifact_empty");
          const prepared = prepareContent ? prepareContent(content) : content;
          const created = await saveArtifact(project, { slot, content: prepared, inputArtifactIds, skill: operation });
          await finishTrace(project, trace, "accepted", reason, created.id);
          return created;
        } catch (error) {
          response = await chat.sendMessage({ message: [{ functionResponse: { id: call.id, name: call.name, response: { error: error instanceof Error ? error.message : String(error) } } }] });
          continue;
        }
      }
      const tool = sessionTools.find((candidate) => candidate.declaration.name === call.name);
      if (!tool) throw new Error(`unknown_session_tool:${call.name}`);
      try {
        const result = await tool.run((call.args ?? {}) as Record<string, unknown>);
        response = await chat.sendMessage({ message: [{ functionResponse: { id: call.id, name: call.name, response: { result } } }] });
      } catch (error) {
        response = await chat.sendMessage({ message: [{ functionResponse: { id: call.id, name: call.name, response: { error: error instanceof Error ? error.message : String(error) } } }] });
      }
    }
    throw new Error("session_call_budget_exhausted");
  } catch (error) {
    await finishTrace(project, trace, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
