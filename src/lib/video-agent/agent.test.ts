import { describe, expect, it } from "vitest";
import { selectVideoSpecialist } from "./planners";
import { allowedActions, type LocalVideoProject } from "./state";
import { enforceIdentityLineage, inspectPlan, validatePlanIdentity, validatePlanStructure, videoPlanSchema, videoTreatmentSchema } from "./tools/planning";
import { validateReferenceLineage } from "./tools/render-storyboard";
import { sanitizeResearchQuestion } from "./tools/research";
import { createBasicIdentity } from "./tools/set-identity";

const spokenLine = { speaker: "narrator", line: "You thought I wouldn't know?", voiceDirection: "warm conversational voice" };
const voiceProfiles = [{ speaker: "narrator", voice: "one consistent warm mid-range adult voice with a clear neutral accent" }];
const subject = { characterId: "character_1", visibleDescription: "character_1 in this story state", wardrobe: "", positionOrRelation: "center frame", expressionOrPose: "alert and attentive" };
const originalReference = { kind: "original" as const, identityReferenceId: "identity_1", fromSceneId: "" };
const character = {
  id: "character_1",
  role: "primary_subject" as const,
  subjectKind: "person",
  physicalDescription: "a person with short dark hair and round glasses",
  immutableTraits: ["short dark hair", "round glasses"],
  defaultAccessories: [],
  identityReferenceId: "identity_1",
};
const identityReference = { id: "identity_1", kind: "upload" as const, uri: "/tmp/source.jpg", characterIds: ["character_1"], planVersion: 0, status: "ready" as const };

describe("unified video workflow", () => {
  it("registers the uploaded pixels as identity without inventing visual traits", () => {
    const identity = createBasicIdentity("/tmp/source.jpg");
    expect(identity.characters).toEqual([expect.objectContaining({ id: "character_1", role: "primary_subject", identityReferenceId: "identity_1", immutableTraits: [] })]);
    expect(identity.references).toEqual([expect.objectContaining({ id: "identity_1", uri: "/tmp/source.jpg", characterIds: ["character_1"] })]);
  });

  it("uses generic planning without a specialist", () => {
    const identity = createBasicIdentity("/tmp/source.jpg", "person");
    expect(identity.characters[0]).toEqual(expect.objectContaining({ role: "primary_subject", subjectKind: "person" }));
    expect(selectVideoSpecialist(identity.characters)).toBeUndefined();
  });

  it("exposes only the legal next creative tool", () => {
    const project = { stage: "collecting" } as LocalVideoProject;
    expect(allowedActions(project)).toEqual(["set_identity"]);
    project.stage = "identity_ready";
    expect(allowedActions(project)).toEqual(["lock_hook"]);
    project.stage = "hook_ready";
    expect(allowedActions(project)).toEqual(["shape_continuation"]);
    project.stage = "continuation_ready";
    expect(allowedActions(project)).toEqual(["choose_delivery"]);
    project.stage = "delivery_ready";
    expect(allowedActions(project)).toEqual(["write_script"]);
    project.stage = "script_ready";
    expect(allowedActions(project)).toEqual(["design_sequence"]);
    project.stage = "planned";
    expect(allowedActions(project)).toEqual(["render_storyboard"]);
    project.versions = { plan: 1 };
    project.planDiagnostics = [{ code: "dialogue_may_feel_rushed", sceneId: "scene_1", message: "Too many words." }];
    expect(allowedActions(project)).toEqual(["design_sequence", "render_storyboard"]);
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
      voiceProfiles,
      scenes: [
        { id: "scene_1", beatIds: ["beat_1"], startSeconds: 0, endSeconds: 2, framing: "close shot", camera: "locked", visual: "Subject sees evidence", action: "Subject freezes", sound: "sting", spokenLines: [spokenLine], subjects: [subject], reference: originalReference },
        { id: "scene_2", beatIds: ["beat_2"], startSeconds: 3, endSeconds: 10, framing: "medium shot", camera: "reframe", visual: "Subject confronts the situation", action: "Subject stares", sound: "strings", spokenLines: [], subjects: [subject], reference: { kind: "generate", identityReferenceId: "identity_1", fromSceneId: "" } },
      ],
      musicDirection: "Original restrained score",
      continuity: "Preserve exact subject identity",
      finishTitle: "THE TEST",
    })).toThrow();
  });

  it("allows tight multi-shot B-roll without forcing the subject into every shot", () => {
    const plan = videoPlanSchema.parse({
      title: "Fast cut",
      durationSeconds: 5,
      aspectRatio: "9:16",
      voiceProfiles: [],
      scenes: Array.from({ length: 5 }, (_, index) => ({
        id: `scene_${index + 1}`,
        beatIds: ["beat_1"],
        startSeconds: index,
        endSeconds: index + 1,
        framing: "detail insert",
        camera: "hard cut, then a quick digital punch-in",
        visual: "A story-relevant prop fills the frame",
        action: "The prop reveals the next story detail",
        sound: "voiceover continues over a soft music bed",
        spokenLines: [],
        onScreenText: index === 2 ? "THE EVIDENCE" : "",
        subjects: [],
        reference: { kind: "generate", identityReferenceId: "", fromSceneId: "" },
      })),
      musicDirection: "Fast playful rhythm",
      continuity: "Keep the visual language coherent",
      finishTitle: "",
    });
    expect(plan.scenes).toHaveLength(5);
    expect(() => validatePlanIdentity({ characters: [character], referenceAssets: [identityReference], plan })).not.toThrow();
  });

  it("rejects a scene that is detached from canonical identity", () => {
    const plan = videoPlanSchema.parse({
      title: "Test", durationSeconds: 5, aspectRatio: "9:16", voiceProfiles: [], musicDirection: "Warm acoustic music", continuity: "Keep identity stable", finishTitle: "",
      scenes: [{ id: "scene_1", beatIds: ["beat_1"], startSeconds: 0, endSeconds: 5, framing: "close shot", camera: "locked", visual: "Subject notices something", action: "Subject looks up", sound: "soft chime", spokenLines: [], subjects: [{ ...subject, characterId: "char_missing" }], reference: originalReference }],
    });
    expect(() => validatePlanIdentity({ characters: [character], referenceAssets: [identityReference], plan })).toThrow("unknown_scene_character:scene_1");
  });

  it("carries the nearest canonical subject frame into later references", () => {
    const plan = videoPlanSchema.parse({
      title: "Identity chain", durationSeconds: 5, aspectRatio: "9:16", voiceProfiles: [], musicDirection: "Original score", continuity: "Keep identity stable", finishTitle: "",
      scenes: [
        { id: "scene_1", beatIds: ["beat_1"], startSeconds: 0, endSeconds: 2, framing: "wide shot", camera: "locked", visual: "Subject floats inside an orb", action: "Subject rotates", sound: "hum", spokenLines: [], subjects: [subject], reference: { kind: "generate", identityReferenceId: "identity_1", fromSceneId: "" } },
        { id: "scene_2", beatIds: ["beat_2"], startSeconds: 2, endSeconds: 5, framing: "close shot", camera: "push in", visual: "Subject lands beside the orb", action: "Subject looks back", sound: "splash", spokenLines: [], subjects: [subject], reference: { kind: "generate", identityReferenceId: "identity_1", fromSceneId: "" } },
      ],
    });
    expect(enforceIdentityLineage(plan).scenes[1].reference).toEqual({ kind: "edit", identityReferenceId: "identity_1", fromSceneId: "scene_1" });
  });

  it("rejects broken visual-reference lineage", () => {
    expect(() => validateReferenceLineage([
      identityReference,
      { id: "ref_scene_2", kind: "edited", uri: "/tmp/scene-2.png", characterIds: ["character_1"], parentReferenceId: "ref_missing", planVersion: 1, status: "ready" },
    ])).toThrow("reference_parent_missing:ref_scene_2");
  });

  it("keeps structural failures separate from creative diagnostics", () => {
    const treatment = videoTreatmentSchema.parse({
      title: "Reveal", summary: "Subject asks for the hidden package.", tone: ["playful"], durationSeconds: 5, voiceProfiles,
      beats: [{ id: "beat_1", purpose: "hook", event: "Subject notices the hidden package", spokenLines: [{ ...spokenLine, line: "Please can I finally open that mysterious package right now?" }], sound: "soft chime" }],
      musicArc: "Warm playful plucks", ending: "The package is revealed.",
    });
    const plan = videoPlanSchema.parse({
      title: "Reveal", durationSeconds: 5, aspectRatio: "9:16", voiceProfiles, musicDirection: "Warm playful plucks", continuity: "Keep subject identity", finishTitle: "",
      scenes: [{ id: "scene_1", beatIds: ["beat_1"], startSeconds: 0, endSeconds: 2, framing: "close shot", camera: "locked", visual: "Subject watches the package", action: "Subject leans closer", sound: "soft chime", spokenLines: treatment.beats[0].spokenLines, subjects: [subject], reference: originalReference },
        { id: "scene_2", beatIds: ["beat_1"], startSeconds: 2, endSeconds: 5, framing: "medium shot", camera: "reframe", visual: "Package opens", action: "Subject reveals it", sound: "warm resolve", spokenLines: [], subjects: [subject], reference: originalReference }],
    });
    expect(() => validatePlanStructure(treatment, plan)).not.toThrow();
    expect(inspectPlan(plan)).toEqual([expect.objectContaining({ code: "dialogue_may_feel_rushed", sceneId: "scene_1" })]);
  });

  it("removes obvious private data before grounded research", () => {
    expect(sanitizeResearchQuestion("Read https://example.com for me@example.com or +1 (555) 123-4567"))
      .toBe("Read [redacted] for [redacted] or [redacted]");
  });
});
