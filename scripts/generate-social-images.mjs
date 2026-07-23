import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outputDirectory = path.join(root, "public", "social");
const width = 1200;
const height = 630;

await fs.mkdir(outputDirectory, { recursive: true });

const background = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="2" fill="#f4458f" opacity=".18"/>
      </pattern>
    </defs>
    <rect width="1200" height="630" fill="#ffd3e5"/>
    <rect width="1200" height="630" fill="url(#dots)"/>
    <path d="M0 565h1200v65H0z" fill="#241a44"/>
    <rect x="58" y="48" width="180" height="54" rx="12" fill="#ffe36e" stroke="#241a44" stroke-width="5"/>
    <text x="148" y="84" text-anchor="middle" font-family="DejaVu Sans" font-size="26" font-weight="900" fill="#241a44">RARELY ★</text>
    <text x="58" y="190" font-family="DejaVu Sans" font-size="69" font-weight="900" letter-spacing="-3" fill="#fffdf8" stroke="#241a44" stroke-width="7" paint-order="stroke">PET PHOTO</text>
    <text x="58" y="268" font-family="DejaVu Sans" font-size="69" font-weight="900" letter-spacing="-3" fill="#f4458f" stroke="#241a44" stroke-width="7" paint-order="stroke">→ STORY CARD.</text>
    <text x="62" y="326" font-family="DejaVu Sans" font-size="25" font-weight="800" fill="#241a44">We read the stare, posture, light, and room—</text>
    <text x="62" y="363" font-family="DejaVu Sans" font-size="25" font-weight="800" fill="#241a44">then make the card that feels like them.</text>
    <rect x="58" y="405" width="400" height="76" rx="16" fill="#fffdf8" stroke="#241a44" stroke-width="5"/>
    <text x="83" y="437" font-family="DejaVu Sans Mono" font-size="14" font-weight="700" fill="#f4458f">ONE CAT OR DOG · ONE FRAME · $5</text>
    <text x="83" y="463" font-family="DejaVu Sans" font-size="17" font-weight="900" fill="#241a44">Funny first. Then strangely true.</text>
    <text x="58" y="607" font-family="DejaVu Sans" font-size="25" font-weight="900" fill="#fffdf8">RARELY.CARDS</text>
    <text x="1142" y="607" text-anchor="end" font-family="DejaVu Sans Mono" font-size="16" font-weight="700" fill="#ffe36e">NOT BUILT TO BLEND IN.</text>
  </svg>
`);

async function petCard(imagePath, label, accent, position = "center") {
  const photo = await sharp(imagePath)
    .resize(330, 390, { fit: "cover", position })
    .jpeg({ quality: 90 })
    .toBuffer();

  const labelOverlay = Buffer.from(`
    <svg width="370" height="466" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="364" height="460" rx="26" fill="${accent}" stroke="#241a44" stroke-width="6"/>
      <rect x="17" y="17" width="336" height="432" rx="17" fill="#fffdf8" stroke="#241a44" stroke-width="4"/>
      <rect x="20" y="20" width="330" height="42" rx="12" fill="${accent}"/>
      <text x="36" y="48" font-family="DejaVu Sans Mono" font-size="15" font-weight="700" fill="#241a44">${label}</text>
      <rect x="20" y="62" width="330" height="390" rx="8" fill="none" stroke="#241a44" stroke-width="5"/>
    </svg>
  `);
  const frameOverlay = Buffer.from(`
    <svg width="370" height="466" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="364" height="460" rx="26" fill="none" stroke="#241a44" stroke-width="6"/>
      <rect x="17" y="17" width="336" height="432" rx="17" fill="none" stroke="#241a44" stroke-width="4"/>
      <rect x="20" y="20" width="330" height="42" rx="12" fill="${accent}"/>
      <text x="36" y="48" font-family="DejaVu Sans Mono" font-size="15" font-weight="700" fill="#241a44">${label}</text>
      <rect x="20" y="62" width="330" height="390" rx="8" fill="none" stroke="#241a44" stroke-width="5"/>
    </svg>
  `);

  return sharp({
    create: {
      width: 370,
      height: 466,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: labelOverlay, left: 0, top: 0 },
      { input: photo, left: 20, top: 62 },
      { input: frameOverlay, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function createSocialImage({ fileName, pets }) {
  const composites = [{ input: background, left: 0, top: 0 }];
  for (const pet of pets) {
    const card = await petCard(
      path.join(root, pet.image),
      pet.label,
      pet.accent,
      pet.position,
    );
    const rotated = await sharp(card)
      .rotate(pet.rotation, {
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    composites.push({ input: rotated, left: pet.left, top: pet.top });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#ffd3e5",
    },
  })
    .composite(composites)
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toFile(path.join(outputDirectory, fileName));
}

const dog = {
  image: "public/pets/golden-dog.jpg",
  label: "MABEL · THE FLOWER COURIER",
  accent: "#ffe36e",
  position: "center",
  rotation: 4,
  left: 790,
  top: 72,
};

const cat = {
  image: "public/pets/window-cat.jpg",
  label: "MISO · WITNESS OF THE LAST LIGHT",
  accent: "#f4458f",
  position: "center",
  rotation: -5,
  left: 650,
  top: 94,
};

await createSocialImage({
  fileName: "rarely-pets.jpg",
  pets: [cat, dog],
});
await createSocialImage({
  fileName: "rarely-dog.jpg",
  pets: [{ ...dog, left: 760, top: 76, rotation: 2 }],
});
await createSocialImage({
  fileName: "rarely-cat.jpg",
  pets: [{ ...cat, left: 760, top: 76, rotation: -2 }],
});
