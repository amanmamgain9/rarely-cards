import "server-only";

import sharp from "sharp";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 36_000_000;
export const MIN_IMAGE_DIMENSION = 256;
export const MAX_IMAGE_DIMENSION = 6000;

const mimeForFormat = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export type ValidatedImage = {
  mimeType: (typeof mimeForFormat)[keyof typeof mimeForFormat];
  width: number;
  height: number;
  bytes: number;
};

export async function inspectImage(buffer: Buffer): Promise<ValidatedImage> {
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("invalid_image_size");
  }

  const metadata = await sharp(buffer, {
    failOn: "error",
    limitInputPixels: MAX_IMAGE_PIXELS,
  }).metadata();

  const mimeType =
    metadata.format && metadata.format in mimeForFormat
      ? mimeForFormat[metadata.format as keyof typeof mimeForFormat]
      : null;
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!mimeType) throw new Error("unsupported_image_format");
  if (
    width < MIN_IMAGE_DIMENSION ||
    height < MIN_IMAGE_DIMENSION ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION
  ) {
    throw new Error("invalid_image_dimensions");
  }

  return { mimeType, width, height, bytes: buffer.length };
}

export async function prepareImageForGemini(buffer: Buffer) {
  return sharp(buffer, {
    failOn: "error",
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
    .rotate()
    .resize({
      width: 1280,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

