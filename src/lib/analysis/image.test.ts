import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

import { prepareGeneratedSceneForSeedance } from "@/lib/analysis/image";

describe("generated Seedance first frame", () => {
  it("keeps the first frame at the requested 9:16 video dimensions", async () => {
    const source = await readFile("public/pets/window-cat.jpg");
    const prepared = await prepareGeneratedSceneForSeedance(source);
    const metadata = await sharp(prepared).metadata();

    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(720);
    expect(metadata.height).toBe(1280);
  });
});
