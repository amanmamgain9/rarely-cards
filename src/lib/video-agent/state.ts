import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { DeliveryDecision, HookCandidate, HookContinuation, HookDirection, HookEvaluation, PlanDiagnostic, VideoPlan, VideoTreatment } from "./tools/planning.ts";
import type { CharacterProfile, ReferenceAsset } from "./tools/set-identity.ts";

export type ProjectStage = "collecting" | "identity_ready" | "hook_ready" | "continuation_ready" | "delivery_ready" | "script_ready" | "planned" | "storyboard_rendering" | "review";
export type AgentToolName = "get_project_state" | "set_identity" | "lock_hook" | "shape_continuation" | "choose_delivery" | "write_script" | "design_sequence" | "render_storyboard";
export type VideoToolName = AgentToolName | "research_context";

export type ResearchPacket = {
  question: string;
  summary: string;
  sources: Array<{ title: string; url: string }>;
};

export type StoryboardArtifact = {
  sceneId: string;
  referenceId: string;
  path: string;
  source: "original" | "generated" | "edited";
  planVersion: number;
};

export type ToolRun = {
  id: string;
  tool: VideoToolName;
  status: "running" | "ready" | "failed";
  startedAt: string;
  completedAt?: string;
  error?: string;
};

export type LocalVideoProject = {
  id: string;
  request: string;
  sourcePath: string;
  sourceSummary: string;
  outputDir: string;
  stage: ProjectStage;
  versions: { identity?: number; hook?: number; continuation?: number; delivery?: number; script?: number; plan?: number };
  characters: CharacterProfile[];
  referenceAssets: ReferenceAsset[];
  specialistKind?: string;
  hookCandidates?: HookCandidate[];
  hookEvaluations?: HookEvaluation[];
  hook?: HookDirection;
  hookPath?: string;
  continuation?: HookContinuation;
  delivery?: DeliveryDecision;
  script?: VideoTreatment;
  plan?: VideoPlan;
  seedanceInstructionPath?: string;
  planDiagnostics?: PlanDiagnostic[];
  storyboard: StoryboardArtifact[];
  runs: ToolRun[];
  agentLog: Array<Record<string, unknown>>;
};

export function allowedActions(project: LocalVideoProject): AgentToolName[] {
  if (project.stage === "collecting") return ["set_identity"];
  if (project.stage === "identity_ready") return ["lock_hook"];
  if (project.stage === "hook_ready") return ["shape_continuation"];
  if (project.stage === "continuation_ready") return ["choose_delivery"];
  if (project.stage === "delivery_ready") return ["write_script"];
  if (project.stage === "script_ready") return ["design_sequence"];
  if (project.stage === "planned") {
    return project.planDiagnostics?.length && (project.versions.plan ?? 0) < 2
      ? ["design_sequence", "render_storyboard"]
      : ["render_storyboard"];
  }
  return [];
}

export function publicProjectState(project: LocalVideoProject) {
  return {
    projectId: project.id,
    request: project.request,
    stage: project.stage,
    sourceSummary: project.sourceSummary,
    versions: { ...project.versions },
    specialistKind: project.specialistKind,
    hookPath: project.hookPath,
    planDiagnostics: project.planDiagnostics,
    seedanceInstructionPath: project.seedanceInstructionPath,
    storyboard: project.storyboard.map((artifact) => ({ sceneId: artifact.sceneId, status: "ready", source: artifact.source })),
    activeRuns: project.runs.filter((run) => run.status === "running"),
    allowedActions: allowedActions(project),
  };
}

export async function saveProject(project: LocalVideoProject) {
  await writeFile(path.join(project.outputDir, "project.json"), `${JSON.stringify(project, null, 2)}\n`);
}

export async function runTool<T>(project: LocalVideoProject, tool: VideoToolName, action: () => Promise<T>) {
  const run: ToolRun = { id: randomUUID(), tool, status: "running", startedAt: new Date().toISOString() };
  project.runs.push(run);
  await saveProject(project);
  try {
    const result = await action();
    run.status = "ready";
    run.completedAt = new Date().toISOString();
    await saveProject(project);
    return { runId: run.id, result };
  } catch (error) {
    run.status = "failed";
    run.completedAt = new Date().toISOString();
    run.error = error instanceof Error ? error.message : String(error);
    await saveProject(project);
    throw error;
  }
}
