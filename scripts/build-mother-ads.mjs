#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);
const root = process.cwd();
const campaignDir = path.join(root, "marketing/campaigns/mother");
const endCardPath = "/tmp/rarely-mother-end-card.png";

const ads = [
  {
    input: path.join(campaignDir, "corgi-mother-pizza.mp4"),
    output: path.join(campaignDir, "corgi-mother-pizza-ad.mp4"),
    cta: path.join(campaignDir, "brand-cta.mp3"),
    subtitles: "/tmp/rarely-corgi-mother.ass",
    events: [
      ["0:00:00.42", "0:00:03.15", "My mother brought me\\Nto a pizza place..."],
      ["0:00:04.05", "0:00:05.62", "and ordered me water."],
      ["0:00:06.48", "0:00:08.05", "{\\c&H006EE3FF&}I deserve a better mother."],
    ],
  },
  {
    input: path.join(campaignDir, "cat-mother-couch.mp4"),
    output: path.join(campaignDir, "cat-mother-couch-ad.mp4"),
    cta: path.join(campaignDir, "brand-cta.mp3"),
    subtitles: "/tmp/rarely-cat-mother.ass",
    events: [
      ["0:00:01.62", "0:00:04.86", "My mother keeps calling\\Nthis her couch."],
      ["0:00:05.33", "0:00:07.96", "{\\c&H006EE3FF&}She's so cute when\\Nshe's confused."],
    ],
  },
];

function ass(events) {
  const dialogue = events
    .map(([start, end, text]) => `Dialogue: 0,${start},${end},Caption,,0,0,0,,${text}`)
    .join("\n");
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,DejaVu Sans,46,&H00FFFFFF,&H00FFFFFF,&H00441A24,&H50000000,-1,0,0,0,100,100,0,0,1,5,1,8,54,54,196,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialogue}
`;
}

async function makeEndCard() {
  const decoration = [
    [88, 124, 14, "#ffe36e"],
    [644, 180, 10, "#fffdf8"],
    [92, 1014, 11, "#fffdf8"],
    [622, 1082, 16, "#a98cf4"],
    [574, 362, 7, "#ffe36e"],
    [146, 398, 8, "#a98cf4"],
  ]
    .map(([cx, cy, r, fill]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`)
    .join("");
  const svg = Buffer.from(`<svg width="720" height="1280" xmlns="http://www.w3.org/2000/svg">
    <rect width="720" height="1280" fill="#ff9cc5"/>
    ${decoration}
    <text x="360" y="520" text-anchor="middle" font-family="DejaVu Sans" font-size="52" font-weight="800" fill="#241a44">Create a video</text>
    <text x="360" y="590" text-anchor="middle" font-family="DejaVu Sans" font-size="52" font-weight="800" fill="#241a44">of your pet.</text>
    <text x="360" y="790" text-anchor="middle" font-family="DejaVu Sans" font-size="86" font-weight="800" fill="#241a44">Rarely</text>
    <path d="M251 844 C290 820 430 820 469 844" fill="none" stroke="#ffe36e" stroke-width="15" stroke-linecap="round"/>
    <text x="360" y="935" text-anchor="middle" font-family="DejaVu Sans" font-size="34" font-weight="800" letter-spacing="3" fill="#241a44">LINK IN BIO</text>
  </svg>`);
  const icon = await sharp(path.join(root, "public/icons/rarely-512.png"))
    .resize(170, 170)
    .png()
    .toBuffer();
  await sharp(svg).composite([{ input: icon, left: 275, top: 225 }]).png().toFile(endCardPath);
}

async function buildAd(ad) {
  await writeFile(ad.subtitles, ass(ad.events));
  const filter = [
    `[0:v]subtitles=${ad.subtitles},fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=0.35[pet]`,
    "[1:v]fps=30,format=yuv420p[endcard]",
    "[pet][endcard]xfade=transition=fade:duration=0.35:offset=8.058[transitioned]",
    "[transitioned]format=yuv420p[v]",
    "[0:a]apad=pad_dur=3.2[original]",
    "[2:a]adelay=8460:all=1[cta]",
    "[original][cta]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,atrim=duration=11.258[a]",
  ].join(";");
  await run(
    "ffmpeg",
    [
      "-y",
      "-i",
      ad.input,
      "-loop",
      "1",
      "-framerate",
      "30",
      "-t",
      "3.2",
      "-i",
      endCardPath,
      "-i",
      ad.cta,
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      ad.output,
    ],
    { cwd: root, maxBuffer: 8 * 1024 * 1024 },
  );
}

await mkdir(campaignDir, { recursive: true });
await makeEndCard();
for (const ad of ads) await buildAd(ad);
console.log(`Built ${ads.length} finished ads in ${campaignDir}`);
