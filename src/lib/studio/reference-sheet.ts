import sharp from "sharp";

export const MAX_AGENT_PICTURES = 4;

function validCount(count: number) {
  if (count < 1 || count > MAX_AGENT_PICTURES) throw new Error("invalid_picture_count");
}

export function addReferenceLabels(request: string, labels: string[]) {
  validCount(labels.length);
  if (labels.length === 1) return `${request}\nReference picture label: ${JSON.stringify(labels[0])}.`;
  const positions = ["top left", "top right", "bottom left", "bottom right"];
  const panels = labels.map((label, index) => `Panel ${index + 1} (${positions[index]}): ${JSON.stringify(label)}`).join("; ");
  return `${request}\nThe uploaded image is a reference sheet. Read it left-to-right, then top-to-bottom: ${panels}. Treat each panel as a separate labeled source picture, not one scene.`;
}

export async function buildReferenceSheet(images: Buffer[]) {
  validCount(images.length);
  if (images.length === 1) return images[0];
  const tiles = await Promise.all(images.map((image) => sharp(image).rotate().resize({
    width: 760,
    height: 760,
    fit: "contain",
    background: "#f5f2ea",
  }).jpeg({ quality: 90 }).toBuffer()));

  return sharp({
    create: { width: 1600, height: Math.ceil(images.length / 2) * 800, channels: 3, background: "#f5f2ea" },
  }).composite(tiles.map((input, index) => ({
    input,
    left: (index % 2) * 800 + 20,
    top: Math.floor(index / 2) * 800 + 20,
  }))).jpeg({ quality: 90 }).toBuffer();
}
