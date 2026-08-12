#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function argumentValues(name) {
  return process.argv.flatMap((value, index) => value === `--${name}` && process.argv[index + 1] ? [process.argv[index + 1]] : []);
}

function required(value, message) {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

if (existsSync(path.resolve(".env.local"))) process.loadEnvFile(path.resolve(".env.local"));

const imagePath = path.resolve(required(argument("image"), "Pass --image <path>."));
const roles = new Set(["character", "environment", "interface", "production", "style"]);
function reference(value) {
  const split = value.indexOf("=");
  if (split < 1) throw new Error("Pass --reference role[:description]=path.");
  const [role, ...descriptionParts] = value.slice(0, split).split(":");
  if (!roles.has(role)) throw new Error(`Unknown reference role: ${role}`);
  const target = required(value.slice(split + 1), "Reference value is missing.");
  const description = descriptionParts.join(":").trim() || path.basename(target);
  return { role, description, path: path.resolve(target) };
}
const references = [{ path: imagePath, role: "character", description: "primary subject" }, ...argumentValues("reference").map((value) => reference(value))];
if (argumentValues("generate-reference").length) throw new Error("--generate-reference was removed; Visual Agent now chooses production references.");
const request = required(argument("request"), "Pass --request <plain-language request>.");
const outputDir = path.resolve(required(argument("out"), "Pass --out <new directory>."));
const stopAfter = argument("stop-after") || "plan";
if (!new Set(["story", "hook", "delivery", "plan"]).has(stopAfter)) throw new Error("Pass --stop-after story|hook|delivery|plan.");
const resume = process.argv.includes("--resume");
const submit = process.argv.includes("--submit");
if (submit && (!resume || stopAfter !== "plan")) throw new Error("--submit requires --resume --stop-after plan.");
if (!existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);
for (const item of references) if (!existsSync(item.path)) throw new Error(`Image not found: ${item.path}`);
if (existsSync(outputDir) !== resume) {
  throw new Error(resume ? `Output directory not found: ${outputDir}` : `Output directory already exists: ${outputDir}`);
}

const { runLocalVideoAgent } = await import(new URL("./agent.ts", import.meta.url));
const result = await runLocalVideoAgent({ references, request, outputDir, resume, stopAfter });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!submit) {
  process.stdout.write("Video generation was not called.\n");
} else {
  const [store, { videoTools }, seedance] = await Promise.all([
    import("./store/index.ts"), import("./tools/index.ts"), import("./video_models/seedance.ts"),
  ]);
  const project = await store.loadProject(outputDir);
  const grant = await store.grantSeedanceSpend(project);
  const generationId = randomUUID();
  const tools = videoTools({ project });
  const video = await tools.generateVideo(project.current.plan, project.current.delivery, grant.id, argument("user-id") || "local-cli", generationId);
  const taskId = JSON.parse(video.content).taskId;
  let task;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    task = await seedance.getSeedanceVideo(taskId);
    process.stdout.write(`Seedance ${task.status}\n`);
    if (["succeeded", "failed", "expired", "cancelled"].includes(task.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (!task || task.status !== "succeeded" || !task.videoUrl) throw new Error(`seedance_${task?.status || "timeout"}:${task?.errorCode || "unknown"}`);
  const response = await fetch(task.videoUrl);
  if (!response.ok) throw new Error(`seedance_video_download_${response.status}`);
  const videoPath = path.join(outputDir, "seedance-video.mp4");
  await writeFile(videoPath, Buffer.from(await response.arrayBuffer()));
  const mediaId = `video_${generationId}`;
  await store.saveMedia(project, { id: mediaId, kind: "video", path: videoPath });
  await store.updateVideoArtifact(project, video.id, JSON.stringify({ taskId, generationId, status: "succeeded", videoPath, usageTotalTokens: task.usageTotalTokens }, null, 2), [mediaId]);
  process.stdout.write(`${JSON.stringify({ taskId, videoPath, usageTotalTokens: task.usageTotalTokens }, null, 2)}\n`);
}
