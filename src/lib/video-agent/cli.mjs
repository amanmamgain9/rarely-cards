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

function required(value, message) {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

if (existsSync(path.resolve(".env.local"))) process.loadEnvFile(path.resolve(".env.local"));

const imagePath = path.resolve(required(argument("image"), "Pass --image <path>."));
const request = required(argument("request"), "Pass --request <plain-language request>.");
const outputDir = path.resolve(required(argument("out"), "Pass --out <new directory>."));
const stopAfter = argument("stop-after") || "board";
if (!new Set(["story", "hook", "delivery", "plan", "board"]).has(stopAfter)) throw new Error("Pass --stop-after story|hook|delivery|plan|board.");
const resume = process.argv.includes("--resume");
const submit = process.argv.includes("--submit");
if (submit && (!resume || stopAfter !== "board")) throw new Error("--submit requires --resume --stop-after board.");
if (!existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);
if (existsSync(outputDir) !== resume) {
  throw new Error(resume ? `Output directory not found: ${outputDir}` : `Output directory already exists: ${outputDir}`);
}

const { runLocalVideoAgent } = await import(new URL("./agent.ts", import.meta.url));
const result = await runLocalVideoAgent({ imagePath, request, outputDir, resume, stopAfter });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!submit) {
  process.stdout.write("Video generation was not called.\n");
} else {
  const [{ GoogleGenAI }, store, { videoTools }, seedance] = await Promise.all([
    import("@google/genai"), import("./store/index.ts"), import("./tools/index.ts"), import("./video_models/seedance.ts"),
  ]);
  const project = await store.loadProject(outputDir);
  const grant = await store.grantSeedanceSpend(project);
  const generationId = randomUUID();
  const tools = videoTools({ project, ai: new GoogleGenAI({ apiKey: required(process.env.GEMINI_API_KEY, "GEMINI_API_KEY is missing.") }), textModel: process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash", imageModel: process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image" });
  const video = await tools.generateVideo(project.current.plan, project.current.board, project.current.delivery, grant.id, argument("user-id") || "local-cli", generationId);
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
