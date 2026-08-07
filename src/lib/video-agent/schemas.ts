import { z } from "zod";

export const MAX_VIDEO_DURATION_SECONDS = 15;
export const MAX_STORYBOARD_SCENES = 4;

const spokenLineSchema = z.object({
  speaker: z.enum(["pet", "narrator", "other"]),
  line: z.string().trim().min(1).max(180),
  voiceDirection: z.string().trim().min(2).max(160),
});

export const hookSchema = z.object({
  pattern: z.string().trim().min(2).max(60),
  openingVisual: z.string().trim().min(5).max(320),
  openingAudio: z.string().trim().max(180),
  curiosityGap: z.string().trim().min(3).max(180),
  storyPromise: z.string().trim().min(3).max(220),
  payoffObligation: z.string().trim().min(3).max(220),
  researchNeeded: z.boolean(),
  researchQuestion: z.string().trim().max(240),
}).superRefine((hook, context) => {
  if (hook.researchNeeded !== Boolean(hook.researchQuestion)) {
    context.addIssue({ code: "custom", path: ["researchQuestion"], message: "Research question must match researchNeeded." });
  }
});

const treatmentBeatSchema = z.object({
  id: z.string().trim().regex(/^beat_[1-4]$/),
  purpose: z.enum(["hook", "development", "escalation", "climax", "payoff"]),
  event: z.string().trim().min(5).max(360),
  spokenLines: z.array(spokenLineSchema).max(3),
  sound: z.string().trim().min(2).max(240),
});

export const videoTreatmentSchema = z.object({
  title: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(5).max(320),
  tone: z.array(z.string().trim().min(2).max(40)).min(1).max(4),
  durationSeconds: z.number().int().min(5).max(MAX_VIDEO_DURATION_SECONDS),
  beats: z.array(treatmentBeatSchema).min(1).max(MAX_STORYBOARD_SCENES),
  musicArc: z.string().trim().min(3).max(300),
  ending: z.string().trim().min(3).max(240),
}).superRefine((treatment, context) => {
  if (treatment.beats[0]?.purpose !== "hook") {
    context.addIssue({ code: "custom", path: ["beats", 0, "purpose"], message: "First beat must be hook." });
  }
  if (new Set(treatment.beats.map((beat) => beat.id)).size !== treatment.beats.length) {
    context.addIssue({ code: "custom", path: ["beats"], message: "Beat IDs must be unique." });
  }
});

const plannedSceneSchema = z.object({
  id: z.string().trim().regex(/^scene_[1-4]$/),
  beatIds: z.array(z.string().trim().regex(/^beat_[1-4]$/)).min(1).max(4),
  startSeconds: z.number().min(0).max(MAX_VIDEO_DURATION_SECONDS),
  endSeconds: z.number().min(0).max(MAX_VIDEO_DURATION_SECONDS),
  framing: z.string().trim().min(3).max(160),
  camera: z.enum(["locked", "reframe", "pan", "tilt", "tracking", "handheld", "crane", "dolly", "zoom"]),
  visual: z.string().trim().min(5).max(420),
  action: z.string().trim().min(3).max(360),
  sound: z.string().trim().min(2).max(240),
  spokenLines: z.array(spokenLineSchema).max(3),
  subjects: z.array(z.object({
    characterId: z.string().trim().min(1).max(40),
    visibleDescription: z.string().trim().min(3).max(240),
    wardrobe: z.string().trim().max(180),
    positionOrRelation: z.string().trim().max(180),
    expressionOrPose: z.string().trim().max(180),
  })).min(1).max(4),
  reference: z.object({
    kind: z.enum(["original", "generate", "edit"]),
    identityReferenceId: z.string().trim().min(1).max(40),
    fromSceneId: z.string().trim().max(40),
  }),
});

export const videoPlanSchema = z.object({
  title: z.string().trim().min(1).max(80),
  durationSeconds: z.number().int().min(5).max(MAX_VIDEO_DURATION_SECONDS),
  aspectRatio: z.literal("9:16"),
  scenes: z.array(plannedSceneSchema).min(1).max(MAX_STORYBOARD_SCENES),
  musicDirection: z.string().trim().min(3).max(300),
  continuity: z.string().trim().min(3).max(360),
  finishTitle: z.string().trim().max(80),
}).superRefine((plan, context) => {
  if (plan.scenes[0]?.startSeconds !== 0 || plan.scenes.at(-1)?.endSeconds !== plan.durationSeconds) {
    context.addIssue({ code: "custom", path: ["scenes"], message: "Scenes must cover the full duration." });
  }
  plan.scenes.forEach((scene, index) => {
    if (scene.endSeconds <= scene.startSeconds) {
      context.addIssue({ code: "custom", path: ["scenes", index], message: "Scene must have positive duration." });
    }
    if (index > 0 && scene.startSeconds !== plan.scenes[index - 1].endSeconds) {
      context.addIssue({ code: "custom", path: ["scenes", index, "startSeconds"], message: "Scenes must be contiguous." });
    }
    if (scene.reference.kind === "edit") {
      const parentIndex = plan.scenes.findIndex((candidate) => candidate.id === scene.reference.fromSceneId);
      if (parentIndex < 0 || parentIndex >= index) {
        context.addIssue({ code: "custom", path: ["scenes", index, "reference", "fromSceneId"], message: "Edited reference must use an earlier scene." });
      }
    } else if (scene.reference.fromSceneId) {
      context.addIssue({ code: "custom", path: ["scenes", index, "reference", "fromSceneId"], message: "Only edited references have a parent scene." });
    }
  });
});

export type Hook = z.infer<typeof hookSchema>;
export type VideoTreatment = z.infer<typeof videoTreatmentSchema>;
export type VideoPlan = z.infer<typeof videoPlanSchema>;

const spokenLineJsonSchema = {
  type: "object",
  required: ["speaker", "line", "voiceDirection"],
  properties: {
    speaker: { type: "string", enum: ["pet", "narrator", "other"] },
    line: { type: "string" },
    voiceDirection: { type: "string" },
  },
};

export const hookJsonSchema = {
  type: "object",
  required: ["pattern", "openingVisual", "openingAudio", "curiosityGap", "storyPromise", "payoffObligation", "researchNeeded", "researchQuestion"],
  properties: {
    pattern: { type: "string" },
    openingVisual: { type: "string" }, openingAudio: { type: "string" },
    curiosityGap: { type: "string" }, storyPromise: { type: "string" },
    payoffObligation: { type: "string" }, researchNeeded: { type: "boolean" },
    researchQuestion: { type: "string" },
  },
};

export const treatmentJsonSchema = {
  type: "object",
  required: ["title", "summary", "tone", "durationSeconds", "beats", "musicArc", "ending"],
  properties: {
    title: { type: "string" }, summary: { type: "string" },
    tone: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
    durationSeconds: { type: "integer", minimum: 5, maximum: MAX_VIDEO_DURATION_SECONDS },
    beats: { type: "array", minItems: 1, maxItems: MAX_STORYBOARD_SCENES, items: {
      type: "object", required: ["id", "purpose", "event", "spokenLines", "sound"],
      properties: {
        id: { type: "string", enum: ["beat_1", "beat_2", "beat_3", "beat_4"] },
        purpose: { type: "string", enum: ["hook", "development", "escalation", "climax", "payoff"] },
        event: { type: "string" }, spokenLines: { type: "array", maxItems: 3, items: spokenLineJsonSchema }, sound: { type: "string" },
      },
    } },
    musicArc: { type: "string" }, ending: { type: "string" },
  },
};

export const planJsonSchema = {
  type: "object",
  required: ["title", "durationSeconds", "aspectRatio", "scenes", "musicDirection", "continuity", "finishTitle"],
  properties: {
    title: { type: "string" },
    durationSeconds: { type: "integer", minimum: 5, maximum: MAX_VIDEO_DURATION_SECONDS },
    aspectRatio: { type: "string", enum: ["9:16"] },
    scenes: { type: "array", minItems: 1, maxItems: MAX_STORYBOARD_SCENES, items: {
      type: "object",
      required: ["id", "beatIds", "startSeconds", "endSeconds", "framing", "camera", "visual", "action", "sound", "spokenLines", "subjects", "reference"],
      properties: {
        id: { type: "string", enum: ["scene_1", "scene_2", "scene_3", "scene_4"] },
        beatIds: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", enum: ["beat_1", "beat_2", "beat_3", "beat_4"] } },
        startSeconds: { type: "number", minimum: 0, maximum: MAX_VIDEO_DURATION_SECONDS },
        endSeconds: { type: "number", minimum: 0, maximum: MAX_VIDEO_DURATION_SECONDS },
        framing: { type: "string" }, camera: { type: "string", enum: plannedSceneSchema.shape.camera.options },
        visual: { type: "string" }, action: { type: "string" }, sound: { type: "string" },
        spokenLines: { type: "array", maxItems: 3, items: spokenLineJsonSchema },
        subjects: { type: "array", minItems: 1, maxItems: 4, items: {
          type: "object",
          required: ["characterId", "visibleDescription", "wardrobe", "positionOrRelation", "expressionOrPose"],
          properties: {
            characterId: { type: "string" }, visibleDescription: { type: "string" }, wardrobe: { type: "string" },
            positionOrRelation: { type: "string" }, expressionOrPose: { type: "string" },
          },
        } },
        reference: { type: "object", required: ["kind", "identityReferenceId", "fromSceneId"], properties: {
          kind: { type: "string", enum: ["original", "generate", "edit"] }, identityReferenceId: { type: "string" }, fromSceneId: { type: "string" },
        } },
      },
    } },
    musicDirection: { type: "string" }, continuity: { type: "string" }, finishTitle: { type: "string" },
  },
};

export function assertPlanPreservesTreatment(treatment: VideoTreatment, plan: VideoPlan) {
  const treatmentLines = treatment.beats.flatMap((beat) => beat.spokenLines.map((line) => JSON.stringify(line))).sort();
  const planLines = plan.scenes.flatMap((scene) => scene.spokenLines.map((line) => JSON.stringify(line))).sort();
  if (JSON.stringify(treatmentLines) !== JSON.stringify(planLines)) throw new Error("video_plan_changed_spoken_lines");
}
