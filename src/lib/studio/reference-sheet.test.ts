import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { addReferenceLabels, buildReferenceSheet } from "./reference-sheet";

describe("reference sheet", () => {
  it("keeps image and label order", async () => {
    const image = await sharp({ create: { width: 256, height: 256, channels: 3, background: "red" } }).png().toBuffer();
    const sheet = await buildReferenceSheet([image, image, image]);
    const metadata = await sharp(sheet).metadata();
    const request = addReferenceLabels("Make them dance.", ["Hero", "Friend", "Setting"]);

    expect([metadata.width, metadata.height]).toEqual([1600, 1600]);
    expect(request).toContain('Panel 1 (top left): "Hero"');
    expect(request).toContain('Panel 3 (bottom left): "Setting"');
  });
});
