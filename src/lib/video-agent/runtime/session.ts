import { readFile } from "node:fs/promises";
import { deepSeekChat, deepSeekModel, toolArguments, type DeepSeekMessage, type DeepSeekTool } from "../providers/deepseek.ts";
import { artifact, finishTrace, saveArtifact, startTrace, type ArtifactSlot, type VideoProject } from "../store/index.ts";

export type SessionTool = {
  declaration: DeepSeekTool;
  run: (args: Record<string, unknown>) => Promise<string>;
};

export async function runTextSession({
  project, operation, slot, skillPath, inputArtifactIds, focus = "", includeRequest = false, tools = [], maxCalls = 5,
  prepareContent, sessionContext = "",
}: {
  project: VideoProject;
  operation: string;
  slot: Exclude<ArtifactSlot, "video">;
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
  const model = deepSeekModel();
  const trace = await startTrace(project, { owner: "session", operation, inputArtifactIds, models: [model] });
  const messages: DeepSeekMessage[] = [
    {
      role: "system",
      content: [
        skill,
        "You own this session's context, model calls, private tool use, judgment, and stop condition.",
        "Inputs are locked. Drafts and tool results stay private.",
        "Call tools only when useful. When done, stop calling tools and return the complete final artifact as assistant content.",
        "Return JSON only when production-planning skill requires it.",
      ].join("\n\n"),
    },
    {
      role: "user",
      content: [
        includeRequest ? `# Verbatim creator request\n${project.request.text}` : "",
        `# Subject canon\n${JSON.stringify(project.canon, null, 2)}`,
        sessionContext ? `# Session boundary\n${sessionContext}` : "",
        ...inputs.map((input) => `# Input artifact ${input.id}\n${input.content}`),
        focus ? `# Retry focus\n${focus}` : "",
      ].filter(Boolean).join("\n\n"),
    },
  ];
  const declarations = tools.map((tool) => tool.declaration);
  try {
    for (let turn = 0; turn < maxCalls; turn += 1) {
      const response = await deepSeekChat({ messages, tools: declarations });
      messages.push(response);
      const calls = response.tool_calls ?? [];
      if (calls.length) {
        for (const call of calls) {
          let result: string;
          try {
            const args = toolArguments(call);
            const tool = tools.find((candidate) => candidate.declaration.name === call.function.name);
            if (!tool) throw new Error(`unknown_session_tool:${call.function.name}`);
            result = await tool.run(args);
          } catch (error) {
            result = JSON.stringify({ error: error instanceof Error ? error.message : String(error) });
          }
          messages.push({ role: "tool", tool_call_id: call.id, content: result });
        }
        continue;
      }

      const content = response.content?.trim();
      if (!content) {
        messages.push({ role: "user", content: "Final artifact was empty. Return the complete artifact, or call a useful tool." });
        continue;
      }
      try {
        const prepared = prepareContent ? prepareContent(content) : content;
        const created = await saveArtifact(project, { slot, content: prepared, inputArtifactIds, skill: operation });
        await finishTrace(project, trace, "accepted", "Terminal response validated and persisted.", created.id);
        return created;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        messages.push({ role: "user", content: `Artifact rejected by boundary validation: ${reason.slice(0, 1000)}. Correct it and return the complete artifact.` });
      }
    }
    throw new Error("session_call_budget_exhausted");
  } catch (error) {
    await finishTrace(project, trace, "failed", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
