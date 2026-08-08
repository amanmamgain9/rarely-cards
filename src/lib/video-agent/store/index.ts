import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ARTIFACT_SLOTS, type ArtifactSlot, type MediaRecord, type ProductionPlan, type SessionTrace, type SpendGrant, type SubjectCanon, type VideoArtifact, type VideoProject } from "./types.ts";

const downstream: Record<ArtifactSlot, ArtifactSlot[]> = {
  story: ["hook", "delivery", "plan", "board", "video"],
  hook: ["delivery", "plan", "board", "video"],
  delivery: ["plan", "board", "video"],
  plan: ["board", "video"],
  board: ["video"],
  video: [],
};

export async function createProject({ outputDir, sourcePath, request }: { outputDir: string; sourcePath: string; request: string }) {
  const configuredImageBudget = Number(process.env.VIDEO_AGENT_IMAGE_BUDGET || 12);
  const imageBudget = Number.isInteger(configuredImageBudget) && configuredImageBudget > 0 ? configuredImageBudget : 12;
  const project: VideoProject = {
    id: randomUUID(), outputDir, sourcePath,
    request: { text: request.trim(), createdAt: new Date().toISOString() },
    artifacts: [], current: {}, media: [], traces: [], spendGrants: [],
    imageBudget: { limit: imageBudget, used: 0 },
  };
  await mkdir(outputDir, { recursive: true });
  await saveProject(project);
  return project;
}

export async function loadProject(outputDir: string) {
  return JSON.parse(await readFile(path.join(outputDir, "project.json"), "utf8")) as VideoProject;
}

export async function saveProject(project: VideoProject) {
  await writeFile(path.join(project.outputDir, "project.json"), `${JSON.stringify(project, null, 2)}\n`);
}

export async function saveCanon(project: VideoProject, canon: SubjectCanon) {
  project.canon = canon;
  project.media = canon.references.map((reference) => ({
    id: reference.id, kind: "reference", path: reference.path, createdAt: canon.createdAt,
  }));
  await writeFile(path.join(project.outputDir, "canon.json"), `${JSON.stringify(canon, null, 2)}\n`);
  await saveProject(project);
}

export function artifact(project: VideoProject, id: string, expectedSlot?: ArtifactSlot) {
  const found = project.artifacts.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`artifact_missing:${id}`);
  if (expectedSlot && found.slot !== expectedSlot) throw new Error(`artifact_slot_mismatch:${id}`);
  return found;
}

export function currentArtifact(project: VideoProject, slot: ArtifactSlot) {
  const id = project.current[slot];
  if (!id) throw new Error(`current_artifact_missing:${slot}`);
  return artifact(project, id, slot);
}

export function assertCurrentInputs(project: VideoProject, inputs: Array<[ArtifactSlot, string]>) {
  for (const [slot, id] of inputs) {
    if (project.current[slot] !== id) throw new Error(`stale_artifact:${id}`);
    artifact(project, id, slot);
  }
}

export async function saveArtifact(project: VideoProject, input: Omit<VideoArtifact, "id" | "version" | "path" | "createdAt"> & { extension?: "md" | "json" }) {
  const version = project.artifacts.filter((candidate) => candidate.slot === input.slot).length + 1;
  const id = `${input.slot}_v${version}`;
  const extension = input.extension ?? (input.slot === "plan" || input.slot === "board" || input.slot === "video" ? "json" : "md");
  const directory = path.join(project.outputDir, "artifacts", input.slot);
  const artifactPath = path.join(directory, `${id}.${extension}`);
  await mkdir(directory, { recursive: true });
  await writeFile(artifactPath, `${input.content.trim()}\n`);
  const created: VideoArtifact = { ...input, id, version, path: artifactPath, createdAt: new Date().toISOString() };
  project.artifacts.push(created);
  project.current[input.slot] = id;
  for (const slot of downstream[input.slot]) delete project.current[slot];
  await saveProject(project);
  return created;
}

export async function saveMedia(project: VideoProject, record: Omit<MediaRecord, "createdAt">) {
  project.media = [...project.media.filter((candidate) => candidate.id !== record.id), { ...record, createdAt: new Date().toISOString() }];
  await saveProject(project);
}

export async function updateVideoArtifact(project: VideoProject, id: string, content: string, mediaIds: string[] = []) {
  const item = artifact(project, id, "video");
  item.content = content;
  item.mediaIds = mediaIds;
  await writeFile(item.path, `${content.trim()}\n`);
  await saveProject(project);
}

export function media(project: VideoProject, id: string) {
  const found = project.media.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`media_missing:${id}`);
  return found;
}

export async function startTrace(project: VideoProject, input: Pick<SessionTrace, "owner" | "operation" | "inputArtifactIds" | "models">) {
  const trace: SessionTrace = { ...input, id: randomUUID(), status: "running", startedAt: new Date().toISOString() };
  project.traces.push(trace);
  await saveProject(project);
  return trace;
}

export async function finishTrace(project: VideoProject, trace: SessionTrace, status: Exclude<SessionTrace["status"], "running">, reason: string, outputArtifactId?: string) {
  trace.status = status;
  trace.reason = reason;
  trace.outputArtifactId = outputArtifactId;
  trace.completedAt = new Date().toISOString();
  await saveProject(project);
}

export async function grantSeedanceSpend(project: VideoProject) {
  const grant: SpendGrant = { id: randomUUID(), purpose: "seedance", status: "available", createdAt: new Date().toISOString() };
  project.spendGrants.push(grant);
  await saveProject(project);
  return grant;
}

export async function consumeSpendGrant(project: VideoProject, id: string) {
  const grant = project.spendGrants.find((candidate) => candidate.id === id && candidate.purpose === "seedance");
  if (!grant || grant.status !== "available") throw new Error("seedance_spend_not_authorized");
  grant.status = "consumed";
  grant.consumedAt = new Date().toISOString();
  await saveProject(project);
}

export async function reserveImageGeneration(project: VideoProject) {
  if (project.imageBudget.used >= project.imageBudget.limit) throw new Error("image_budget_exhausted");
  project.imageBudget.used += 1;
  await saveProject(project);
}

export function recoverInterruptedTraces(project: VideoProject) {
  const now = new Date().toISOString();
  for (const trace of project.traces.filter((candidate) => candidate.status === "running")) {
    trace.status = "failed";
    trace.reason = "session_interrupted";
    trace.completedAt = now;
  }
}

export { ARTIFACT_SLOTS };
export type { ArtifactSlot, MediaRecord, ProductionPlan, SessionTrace, SpendGrant, SubjectCanon, VideoArtifact, VideoProject };
