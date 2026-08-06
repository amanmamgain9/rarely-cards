#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const TASKS_PATH = "/api/v3/contents/generations/tasks";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function required(value, message) {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

async function prepareVerticalFirstFrame(inputPath) {
  const image = await readFile(inputPath);
  const background = await sharp(image)
    .rotate()
    .resize(720, 1280, { fit: "cover" })
    .blur(28)
    .modulate({ brightness: 0.62, saturation: 0.72 })
    .toBuffer();
  const foreground = await sharp(image)
    .rotate()
    .resize(720, 1280, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp(background)
    .composite([{ input: foreground }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

async function apiRequest(baseUrl, apiKey, route, init) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Seedance request failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function main() {
  const inputPath = path.resolve(required(argument("image"), "Pass --image <path>."));
  const outputPath = path.resolve(required(argument("out"), "Pass --out <path>."));
  const line = required(argument("line"), "Pass --line <dialogue>.");
  const subject = required(argument("subject"), "Pass --subject <pet description>.");
  const performance = required(
    argument("performance"),
    "Pass --performance <voice and delivery direction>.",
  );
  const motion = argument("motion")?.trim();
  const apiKey = required(process.env.BYTEPLUS_ARK_API_KEY, "BYTEPLUS_ARK_API_KEY is missing.");
  const baseUrl = (process.env.BYTEPLUS_ARK_BASE_URL || "https://ark.ap-southeast.bytepluses.com").replace(/\/$/, "");
  const model = process.env.SEEDANCE_MODEL || "dreamina-seedance-2-0-260128";
  const firstFrame = await prepareVerticalFirstFrame(inputPath);
  const prompt = [
    `Create one continuous photorealistic vertical portrait video of ${subject} in the supplied first frame.`,
    "Preserve the exact animal, face, fur markings, proportions, lighting, setting, and photographic realism throughout.",
    "Use restrained natural pet motion only: gentle breathing, subtle blinking, and one tiny ear or head movement.",
    motion ? `Performance blocking: ${motion}` : null,
    `The pet clearly says exactly: “${line}”`,
    `Voice performance: ${performance}`,
    "The voice must sound like it is genuinely coming from the animal in the frame, with no off-screen narrator and no second voice.",
    "Synchronize the mouth naturally and precisely without adding human lips, human teeth, or exaggerated facial anatomy.",
    "Keep one stable shot and let the pet's existing expression carry the joke.",
    "Natural room tone only. No music, captions, text, logos, watermark, cuts, camera movement, new objects, extra animals, extra speech, distorted anatomy, or dramatic performance.",
  ].filter(Boolean).join(" ");
  const generationId = randomUUID();
  const safetyIdentifier = createHash("sha256").update(generationId).digest("hex").slice(0, 32);
  const created = await apiRequest(baseUrl, apiKey, TASKS_PATH, {
    method: "POST",
    body: JSON.stringify({
      model,
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          role: "first_frame",
          image_url: { url: `data:image/jpeg;base64,${firstFrame.toString("base64")}` },
        },
      ],
      generate_audio: true,
      resolution: "720p",
      ratio: "9:16",
      duration: 8,
      watermark: false,
      safety_identifier: safetyIdentifier,
      execution_expires_after: 3600,
    }),
  });
  if (!created?.id) throw new Error("Seedance did not return a task ID.");
  process.stdout.write(`Task ${created.id} submitted.\n`);

  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    const task = await apiRequest(baseUrl, apiKey, `${TASKS_PATH}/${encodeURIComponent(created.id)}`);
    process.stdout.write(`Status: ${task.status}\n`);
    if (task.status === "failed" || task.status === "expired" || task.status === "cancelled") {
      throw new Error(`Seedance task ended with status ${task.status}: ${JSON.stringify(task.error || {})}`);
    }
    if (task.status !== "succeeded") continue;
    const videoUrl = task.content?.video_url;
    if (!videoUrl) throw new Error("Seedance succeeded without a video URL.");
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error(`Video download failed (${videoResponse.status}).`);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, Buffer.from(await videoResponse.arrayBuffer()));
    process.stdout.write(`Saved ${outputPath}\n`);
    return;
  }
  throw new Error("Seedance generation timed out after 20 minutes.");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
