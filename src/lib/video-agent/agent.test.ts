import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertCurrentInputs, consumeSpendGrant, createProject, grantSeedanceSpend, saveArtifact } from "./store";
import { sampleHookTerritories } from "./tools/create-visual-hook/catalog";
import { productionPlanSchema, validatePlanCanon } from "./tools/compile-video/schema";
import { validateDelivery } from "./tools/write-delivery";

const temporary: string[] = [];

async function project() {
  const outputDir = await mkdtemp(path.join(tmpdir(), "video-agent-test-"));
  temporary.push(outputDir);
  return createProject({ outputDir, referenceInputs: [{ path: path.join(outputDir, "source.jpg"), role: "character", description: "primary subject" }], request: "Flaunting the new bathrobe" });
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("video agent V3 boundaries", () => {
  it("invalidates every downstream current artifact when story changes", async () => {
    const state = await project();
    const story = await saveArtifact(state, { slot: "story", content: "story", inputArtifactIds: [], skill: "funny-cute-story" });
    const hook = await saveArtifact(state, { slot: "hook", content: "hook", inputArtifactIds: [story.id], skill: "visual-hook" });
    const delivery = await saveArtifact(state, { slot: "delivery", content: "delivery", inputArtifactIds: [story.id, hook.id], skill: "delivery-writing" });
    await saveArtifact(state, { slot: "plan", content: "{}", inputArtifactIds: [story.id, hook.id, delivery.id], skill: "production-planning" });

    const replacement = await saveArtifact(state, { slot: "story", content: "better story", inputArtifactIds: [], skill: "funny-cute-story" });

    expect(state.current).toEqual({ story: replacement.id });
    expect(() => assertCurrentInputs(state, [["story", story.id]])).toThrow(`stale_artifact:${story.id}`);
  });

  it("consumes a Seedance spend grant exactly once", async () => {
    const state = await project();
    const grant = await grantSeedanceSpend(state);
    await consumeSpendGrant(state, grant.id);
    await expect(consumeSpendGrant(state, grant.id)).rejects.toThrow("seedance_spend_not_authorized");
  });

  it("samples hook territories deterministically without one fixed favorite", () => {
    const first = sampleHookTerritories("story_v1");
    expect(sampleHookTerritories("story_v1")).toEqual(first);
    expect(sampleHookTerritories("story_v2")).not.toEqual(first);
    expect(first.visualHooks).toHaveLength(5);
  });

  it("keeps machine validation at production boundary", () => {
    const plan = productionPlanSchema.parse({
      title: "Bathrobe", durationSeconds: 6, aspectRatio: "9:16", voiceProfiles: [], continuity: "Keep robe and identity exact", music: "playful",
      shots: [
        { id: "shot_1", startSeconds: 0, endSeconds: 2, storyEvent: "Reveal", frame: "Close reveal", action: "Subject turns", camera: "push", sound: "sting", spokenLines: [], onScreenText: "", subjects: [{ characterId: "character_1", wardrobe: "locked robe", pose: "turning", relation: "center" }] },
        { id: "shot_2", startSeconds: 2, endSeconds: 6, storyEvent: "Payoff", frame: "Wide payoff", action: "Subject poses", camera: "hold", sound: "resolve", spokenLines: [], onScreenText: "", subjects: [{ characterId: "character_1", wardrobe: "locked robe", pose: "posing", relation: "center" }] },
      ],
    });
    expect(plan.shots.map((shot) => shot.id)).toEqual(["shot_1", "shot_2"]);
  });

  it("allows separate identity references in one shot", () => {
    const plan = productionPlanSchema.parse({
      title: "Fight", durationSeconds: 4, aspectRatio: "9:16", voiceProfiles: [], continuity: "locked", music: "",
      shots: [{ id: "shot_1", startSeconds: 0, endSeconds: 4, storyEvent: "character_1 faces character_2", frame: "character_1 and character_2", action: "character_1 dodges character_2", camera: "wide", sound: "", spokenLines: [], onScreenText: "", subjects: [
        { characterId: "character_1", wardrobe: "", pose: "ready", relation: "left" },
        { characterId: "character_2", wardrobe: "", pose: "ready", relation: "right" },
      ] }],
    });
    expect(validatePlanCanon(plan, { characters: [{ id: "character_1" }, { id: "character_2" }], references: [{ id: "identity_1", characterIds: ["character_1"] }, { id: "identity_2", characterIds: ["character_2"] }] })).toBe(plan);
  });

  it("rejects speech that cannot fit a short video", () => {
    const words = Array.from({ length: 33 }, () => "word").join(" ");
    expect(() => validateDelivery(`SPEECH: DOG | ${words} | fast`)).toThrow("delivery_speech_too_long:33");
  });
});
