#!/usr/bin/env node

import { existsSync } from "node:fs";
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
const stopAfter = argument("stop-after") || "storyboard";
if (!new Set(["hook", "storyboard"]).has(stopAfter)) throw new Error("Pass --stop-after hook|storyboard.");
const resume = process.argv.includes("--resume");
if (!existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);
if (existsSync(outputDir) !== resume) {
  throw new Error(resume ? `Output directory not found: ${outputDir}` : `Output directory already exists: ${outputDir}`);
}

const { runLocalVideoAgent } = await import(new URL("./agent.ts", import.meta.url));
const result = await runLocalVideoAgent({ imagePath, request, outputDir, resume, stopAfter });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.stdout.write("Video generation was not called.\n");
