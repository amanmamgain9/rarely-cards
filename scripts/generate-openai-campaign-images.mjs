import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const promptsPath = path.join(
  root,
  "marketing",
  "campaigns",
  "AI_IMAGE_PROMPTS.md",
);
const outputDirectory = path.join(
  root,
  "marketing",
  "campaigns",
  "ai-generated",
);
const originalsDirectory = path.join(outputDirectory, "originals");

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const concurrency = Number(process.env.OPENAI_IMAGE_CONCURRENCY || "2");

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required");
}

const qualityBlock = `
Vertical portrait composition designed to crop cleanly to 9:16. Premium
photorealistic documentary photography, emotionally intimate but completely
natural, plausible available light, physically accurate animal anatomy,
correct paws, eyes, ears, whiskers and fur direction, subtle sensor grain,
realistic dynamic range, restrained colour grade, authentic lived-in details,
no artificial bokeh, no HDR look, no glossy commercial stock-photo finish.
No words, typography, watermark, logo, card border, fantasy effects, duplicated
animals, malformed anatomy, extra limbs, human-like pet expressions, or visible
brand names. Leave safe negative space near the top and bottom for restrained
captions.
`.replace(/\s+/g, " ").trim();

function parsePrompts(markdown) {
  const lines = markdown.split(/\r?\n/);
  const prompts = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^Filename: `([^`]+)`$/);
    if (!match) continue;

    const promptLines = [];
    let cursor = index + 1;
    while (cursor < lines.length && lines[cursor].trim() === "") cursor += 1;
    while (cursor < lines.length && lines[cursor].startsWith(">")) {
      promptLines.push(lines[cursor].replace(/^>\s?/, ""));
      cursor += 1;
    }

    prompts.push({
      filename: match[1],
      campaign: match[1].slice(0, 2),
      kind: match[1].includes("-a-") ? "hero" : "context",
      prompt: `${promptLines.join(" ")} ${qualityBlock}`.replace(/\s+/g, " "),
    });
  }

  return prompts;
}

async function requestWithRetry(makeRequest, label) {
  let delay = 4_000;
  let lastError;

  for (let attempt = 1; attempt <= 7; attempt += 1) {
    try {
      const response = await makeRequest();
      if (response.ok) return response.json();

      const body = await response.text();
      const error = new Error(`${label}: ${response.status} ${body}`);
      error.retryable = [408, 409, 429, 500, 502, 503, 504].includes(
        response.status,
      );
      if (!error.retryable) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (error.retryable === false) throw error;
      if (attempt === 7) break;
    }

    console.warn(
      `${label}: ${lastError.message}; retrying in ${delay / 1000}s`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 60_000);
  }

  throw lastError;
}

async function responseImageBuffer(payload) {
  const image = payload.data?.[0];
  if (image?.b64_json) return Buffer.from(image.b64_json, "base64");
  if (image?.url) {
    const response = await fetch(image.url);
    if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error(`Image API returned no image: ${JSON.stringify(payload)}`);
}

async function generateHero(prompt, label) {
  const payload = await requestWithRetry(
    () =>
      fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          quality: "high",
          size: "1024x1536",
          output_format: "png",
        }),
      }),
    label,
  );
  return responseImageBuffer(payload);
}

async function generateContext(prompt, referencePath, label) {
  const payload = await requestWithRetry(async () => {
    const form = new FormData();
    const reference = await fs.readFile(referencePath);
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("image", new Blob([reference], { type: "image/png" }), "reference.png");
    form.append("n", "1");
    form.append("quality", "high");
    form.append("size", "1024x1536");
    form.append("output_format", "png");

    return fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  }, label);
  return responseImageBuffer(payload);
}

async function saveImage(buffer, filename) {
  const originalPath = path.join(originalsDirectory, filename);
  const finalPath = path.join(outputDirectory, filename);
  await fs.writeFile(originalPath, buffer);
  await sharp(buffer)
    .resize(1080, 1920, { fit: "cover", position: "centre" })
    .png()
    .toFile(finalPath);
  return { originalPath, finalPath };
}

async function processCampaign(entries) {
  const hero = entries.find((entry) => entry.kind === "hero");
  const context = entries.find((entry) => entry.kind === "context");
  if (!hero || !context) {
    throw new Error(`Campaign ${entries[0]?.campaign} is missing a prompt`);
  }

  const heroOriginal = path.join(originalsDirectory, hero.filename);
  const heroFinal = path.join(outputDirectory, hero.filename);
  try {
    await Promise.all([fs.access(heroOriginal), fs.access(heroFinal)]);
    console.log(`[${hero.campaign}] hero exists, reusing`);
  } catch {
    console.log(`[${hero.campaign}] generating hero with ${model}`);
    const buffer = await generateHero(hero.prompt, `${hero.campaign} hero`);
    await saveImage(buffer, hero.filename);
  }

  const contextOriginal = path.join(originalsDirectory, context.filename);
  const contextFinal = path.join(outputDirectory, context.filename);
  try {
    await Promise.all([fs.access(contextOriginal), fs.access(contextFinal)]);
    console.log(`[${context.campaign}] context exists, reusing`);
  } catch {
    console.log(`[${context.campaign}] generating context from hero reference`);
    const buffer = await generateContext(
      context.prompt,
      heroOriginal,
      `${context.campaign} context`,
    );
    await saveImage(buffer, context.filename);
  }
}

async function main() {
  await fs.mkdir(originalsDirectory, { recursive: true });
  const prompts = parsePrompts(await fs.readFile(promptsPath, "utf8"));
  if (prompts.length !== 20) {
    throw new Error(`Expected 20 prompts, found ${prompts.length}`);
  }

  const campaigns = [...new Set(prompts.map((prompt) => prompt.campaign))].map(
    (campaign) => prompts.filter((prompt) => prompt.campaign === campaign),
  );

  let cursor = 0;
  async function worker() {
    while (cursor < campaigns.length) {
      const current = campaigns[cursor];
      cursor += 1;
      await processCampaign(current);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(concurrency, campaigns.length)) },
      worker,
    ),
  );
  console.log(`Generated ${prompts.length} campaign images in ${outputDirectory}`);
}

await main();
