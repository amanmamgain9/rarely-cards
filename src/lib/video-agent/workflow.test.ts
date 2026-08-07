import { describe, expect, it } from "vitest";
import { buildSeedancePackage, createBasicIdentity, inspectPlan, sanitizeResearchQuestion, selectVideoPlanner, validatePlanIdentity, validatePlanStructure, validateReferenceLineage, videoPlanSchema, videoTreatmentSchema } from "./workflow";
import { allowedActions, type LocalVideoProject } from "./project";

const spokenLine = { speaker: "pet" as const, line: "You thought I wouldn't know?", voiceDirection: "natural young child voice" };
const subject = { characterId: "char_primary", visibleDescription: "same golden dog in this story state", wardrobe: "", positionOrRelation: "center frame", expressionOrPose: "alert with ears lifted" };
const originalReference = { kind: "original" as const, identityReferenceId: "ref_original", fromSceneId: "" };
const character = {
  id: "char_primary",
  role: "primary_pet" as const,
  subjectKind: "pet" as const,
  species: "dog",
  breedOrType: "golden retriever",
  physicalDescription: "a medium golden retriever with a cream muzzle and floppy ears",
  immutableTraits: ["cream muzzle", "floppy ears"],
  defaultAccessories: [],
  identityReferenceId: "ref_original",
};
const identityReference = { id: "ref_original", kind: "upload" as const, uri: "/tmp/source.jpg", characterIds: ["char_primary"], planVersion: 0, status: "ready" as const };

describe("unified video workflow", () => {
  it("registers the uploaded pixels as identity without inventing visual traits", () => {
    const identity = createBasicIdentity("/tmp/source.jpg");
    expect(identity.characters).toEqual([expect.objectContaining({ id: "char_primary", role: "primary_pet", identityReferenceId: "ref_original", immutableTraits: [] })]);
    expect(identity.references).toEqual([expect.objectContaining({ id: "ref_original", uri: "/tmp/source.jpg", characterIds: ["char_primary"] })]);
  });

  it("routes non-pet uploads to the generic planner", () => {
    const identity = createBasicIdentity("/tmp/source.jpg", "person");
    expect(identity.characters[0]).toEqual(expect.objectContaining({ role: "primary_person", subjectKind: "person" }));
    expect(selectVideoPlanner(identity.characters).kind).toBe("generic");
  });

  it("exposes only the legal next creative tool", () => {
    const project = { stage: "collecting" } as LocalVideoProject;
    expect(allowedActions(project)).toEqual(["set_identity"]);
    project.stage = "identity_ready";
    expect(allowedActions(project)).toEqual(["create_hook"]);
    project.stage = "hook_ready";
    expect(allowedActions(project)).toEqual(["write_video"]);
    project.stage = "treatment_ready";
    expect(allowedActions(project)).toEqual(["design_video"]);
    project.stage = "planned";
    expect(allowedActions(project)).toEqual(["render_storyboard"]);
    project.versions = { plan: 1 };
    project.planDiagnostics = [{ code: "dialogue_may_feel_rushed", sceneId: "scene_1", message: "Too many words." }];
    expect(allowedActions(project)).toEqual(["design_video", "render_storyboard"]);
    project.versions.plan = 2;
    expect(allowedActions(project)).toEqual(["render_storyboard"]);
    project.stage = "review";
    expect(allowedActions(project)).toEqual([]);
  });

  it("rejects a production plan with timing gaps", () => {
    expect(() => videoPlanSchema.parse({
      title: "Test",
      durationSeconds: 10,
      aspectRatio: "9:16",
      scenes: [
        { id: "scene_1", beatIds: ["beat_1"], startSeconds: 0, endSeconds: 2, framing: "close shot", camera: "locked", visual: "Pet sees evidence", action: "Pet freezes", sound: "sting", spokenLines: [spokenLine], subjects: [subject], reference: originalReference },
        { id: "scene_2", beatIds: ["beat_2"], startSeconds: 3, endSeconds: 10, framing: "medium shot", camera: "reframe", visual: "Pet confronts owner", action: "Pet stares", sound: "strings", spokenLines: [], subjects: [subject], reference: { kind: "generate", identityReferenceId: "ref_original", fromSceneId: "" } },
      ],
      musicDirection: "Original restrained score",
      continuity: "Preserve exact pet identity",
      finishTitle: "THE TEST",
    })).toThrow();
  });

  it("builds one multi-reference Seedance package without submitting", () => {
    const treatment = videoTreatmentSchema.parse({
      title: "Test",
      summary: "Pet discovers a betrayal and confronts the owner.",
      tone: ["cinematic"],
      durationSeconds: 10,
      beats: [{ id: "beat_1", purpose: "hook", event: "Pet sees evidence", spokenLines: [spokenLine], sound: "sting" }],
      musicArc: "Low strings build and resolve.",
      ending: "Owner apologizes.",
    });
    expect(treatment.beats).toHaveLength(1);
    const plan = videoPlanSchema.parse({
      title: "Test",
      durationSeconds: 10,
      aspectRatio: "9:16",
      scenes: [
        { id: "scene_1", beatIds: ["beat_1"], startSeconds: 0, endSeconds: 4, framing: "close shot", camera: "locked", visual: "Pet sees evidence immediately", action: "Pet freezes", sound: "sting", spokenLines: [spokenLine], subjects: [subject], reference: originalReference },
        { id: "scene_2", beatIds: ["beat_1"], startSeconds: 4, endSeconds: 10, framing: "medium shot", camera: "reframe", visual: "Pet confronts owner", action: "Pet stares", sound: "strings", spokenLines: [], subjects: [{ ...subject, wardrobe: "soft blue bathrobe" }], reference: { kind: "generate", identityReferenceId: "ref_original", fromSceneId: "" } },
      ],
      musicDirection: "Original restrained score",
      continuity: "Preserve exact pet identity",
      finishTitle: "THE TEST",
    });
    const prepared = buildSeedancePackage({
      request: "Make a trailer",
      sourcePath: "/tmp/source.jpg",
      characters: [character],
      plan,
      storyboard: [
        { sceneId: "scene_1", referenceId: "ref_original", path: "/tmp/source.jpg", source: "original", planVersion: 1 },
        { sceneId: "scene_2", referenceId: "ref_scene_2", path: "/tmp/scene-2.png", source: "generated", planVersion: 1 },
      ],
    });
    expect(prepared.references).toHaveLength(2);
    expect(prepared.sceneReferences).toEqual({ scene_1: "Image1", scene_2: "Image2" });
    expect(prepared.prompt).toContain("You thought I wouldn't know?");
    expect(prepared.prompt).toContain("soft blue bathrobe");
    expect(prepared.prompt).toContain("cream muzzle");
    expect(prepared.prompt.length).toBeLessThanOrEqual(4000);
  });

  it("rejects a scene that is detached from canonical identity", () => {
    const plan = videoPlanSchema.parse({
      title: "Test", durationSeconds: 5, aspectRatio: "9:16", musicDirection: "Warm acoustic music", continuity: "Keep identity stable", finishTitle: "",
      scenes: [{ id: "scene_1", beatIds: ["beat_1"], startSeconds: 0, endSeconds: 5, framing: "close shot", camera: "locked", visual: "Pet tilts its head", action: "Pet looks up", sound: "soft chime", spokenLines: [], subjects: [{ ...subject, characterId: "char_missing" }], reference: originalReference }],
    });
    expect(() => validatePlanIdentity({ characters: [character], referenceAssets: [identityReference], plan })).toThrow("unknown_scene_character:scene_1");
  });

  it("rejects broken visual-reference lineage", () => {
    expect(() => validateReferenceLineage([
      identityReference,
      { id: "ref_scene_2", kind: "edited", uri: "/tmp/scene-2.png", characterIds: ["char_primary"], parentReferenceId: "ref_missing", planVersion: 1, status: "ready" },
    ])).toThrow("reference_parent_missing:ref_scene_2");
  });

  it("selects pet-specific creative direction without a user-visible mode", () => {
    const planner = selectVideoPlanner([character]);
    expect(planner.kind).toBe("pet");
    expect(planner.refinementBrief).toContain("without turning it into a generic baby");
    expect(planner.treatmentPrompt({ request: "Make her ask for treats", characters: [character], hook: undefined })).toContain("never shrill, nasal, whiny");
  });

  it("keeps structural failures separate from creative diagnostics", () => {
    const treatment = videoTreatmentSchema.parse({
      title: "Treats", summary: "Pet asks sweetly for treats.", tone: ["cute"], durationSeconds: 5,
      beats: [{ id: "beat_1", purpose: "hook", event: "Pet looks at the treat jar", spokenLines: [{ ...spokenLine, line: "Please can I have all of those delicious treats right now?" }], sound: "soft chime" }],
      musicArc: "Warm playful plucks", ending: "Pet gets one treat.",
    });
    const plan = videoPlanSchema.parse({
      title: "Treats", durationSeconds: 5, aspectRatio: "9:16", musicDirection: "Warm playful plucks", continuity: "Keep pet identity", finishTitle: "",
      scenes: [{ id: "scene_1", beatIds: ["beat_1"], startSeconds: 0, endSeconds: 2, framing: "close shot", camera: "locked", visual: "Pet watches treats", action: "Pet tilts head", sound: "soft chime", spokenLines: treatment.beats[0].spokenLines, subjects: [subject], reference: originalReference },
        { id: "scene_2", beatIds: ["beat_1"], startSeconds: 2, endSeconds: 5, framing: "medium shot", camera: "reframe", visual: "Pet receives one treat", action: "Pet takes treat gently", sound: "warm resolve", spokenLines: [], subjects: [subject], reference: originalReference }],
    });
    expect(() => validatePlanStructure(treatment, plan)).not.toThrow();
    expect(inspectPlan(plan)).toEqual([expect.objectContaining({ code: "dialogue_may_feel_rushed", sceneId: "scene_1" })]);
  });

  it("removes obvious private data before grounded research", () => {
    expect(sanitizeResearchQuestion("Read https://example.com for me@example.com or +1 (555) 123-4567"))
      .toBe("Read [redacted] for [redacted] or [redacted]");
  });
});
