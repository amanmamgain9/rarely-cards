import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildSeedanceContent } from "./seedance";

describe("Seedance 2.0 request content", () => {
  it("supports multimodal references without forcing first-frame mode", () => {
    expect(buildSeedanceContent({
      prompt: "The subject speaks, cut to B-roll, then return for the payoff.",
      durationSeconds: 15,
      references: [
        { type: "image", url: "https://example.com/subject.jpg" },
        { type: "video", url: "https://example.com/camera-motion.mp4" },
        { type: "audio", url: "https://example.com/voice.wav" },
      ],
    })).toEqual([
      expect.objectContaining({ type: "text" }),
      expect.objectContaining({ type: "image_url", role: "reference_image" }),
      expect.objectContaining({ type: "video_url", role: "reference_video" }),
      expect.objectContaining({ type: "audio_url", role: "reference_audio" }),
    ]);
  });

  it("keeps provider constraints at the API boundary", () => {
    expect(() => buildSeedanceContent({ prompt: "test", durationSeconds: 16 })).toThrow("seedance_duration_invalid");
    expect(() => buildSeedanceContent({ prompt: "test", firstFrame: "image", references: [{ type: "image", url: "image" }] }))
      .toThrow("seedance_reference_modes_conflict");
    expect(() => buildSeedanceContent({ prompt: "test", references: [{ type: "audio", url: "audio" }] }))
      .toThrow("seedance_audio_requires_visual_reference");
  });
});
