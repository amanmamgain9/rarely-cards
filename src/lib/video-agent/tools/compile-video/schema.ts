import { z } from "zod";

const spokenLine = z.object({ speaker: z.string().trim().min(1), line: z.string().trim().min(1), performance: z.string().trim().min(1) });
const subject = z.object({ characterId: z.string().trim().min(1), wardrobe: z.string().trim(), pose: z.string().trim().min(1), relation: z.string().trim().min(1) });
const shot = z.object({
  id: z.string().trim().regex(/^shot_\d+$/),
  startSeconds: z.number().min(0).max(15),
  endSeconds: z.number().min(0).max(15),
  storyEvent: z.string().trim().min(1),
  frame: z.string().trim().min(1),
  action: z.string().trim().min(1),
  camera: z.string().trim().min(1),
  sound: z.string().trim(),
  spokenLines: z.array(spokenLine),
  onScreenText: z.string().trim(),
  subjects: z.array(subject),
});

export const productionPlanSchema = z.object({
  title: z.string().trim().min(1),
  durationSeconds: z.number().int().min(4).max(15),
  aspectRatio: z.literal("9:16"),
  voiceProfiles: z.array(z.object({ speaker: z.string().trim().min(1), voice: z.string().trim().min(1) })),
  continuity: z.string().trim().min(1),
  music: z.string().trim(),
  shots: z.array(shot).min(1).max(9),
}).superRefine((plan, context) => {
  if (plan.shots[0]?.startSeconds !== 0 || plan.shots.at(-1)?.endSeconds !== plan.durationSeconds) context.addIssue({ code: "custom", path: ["shots"], message: "Shots must cover full duration." });
  plan.shots.forEach((item, index) => {
    if (item.endSeconds <= item.startSeconds || (index && item.startSeconds !== plan.shots[index - 1].endSeconds)) context.addIssue({ code: "custom", path: ["shots", index], message: "Shots must be positive and contiguous." });
  });
  const spokenWords = plan.shots.flatMap((item) => item.spokenLines).flatMap(({ line }) => line.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? []);
  if (spokenWords.length > Math.floor(plan.durationSeconds * 2.5)) context.addIssue({ code: "custom", path: ["shots"], message: "Spoken words exceed executable duration." });
});

export type ProductionPlan = z.infer<typeof productionPlanSchema>;

export const productionPlanJsonSchema = {
  type: "object",
  required: ["title", "durationSeconds", "aspectRatio", "voiceProfiles", "continuity", "music", "shots"],
  properties: {
    title: { type: "string" }, durationSeconds: { type: "integer", minimum: 4, maximum: 15 }, aspectRatio: { type: "string", enum: ["9:16"] }, continuity: { type: "string" }, music: { type: "string" },
    voiceProfiles: { type: "array", items: { type: "object", required: ["speaker", "voice"], properties: { speaker: { type: "string" }, voice: { type: "string" } } } },
    shots: { type: "array", minItems: 1, items: { type: "object", required: ["id", "startSeconds", "endSeconds", "storyEvent", "frame", "action", "camera", "sound", "spokenLines", "onScreenText", "subjects"], properties: {
      id: { type: "string", pattern: "^shot_\\d+$" }, startSeconds: { type: "number" }, endSeconds: { type: "number" }, storyEvent: { type: "string" }, frame: { type: "string" }, action: { type: "string" }, camera: { type: "string" }, sound: { type: "string" }, onScreenText: { type: "string" },
      spokenLines: { type: "array", items: { type: "object", required: ["speaker", "line", "performance"], properties: { speaker: { type: "string" }, line: { type: "string" }, performance: { type: "string" } } } },
      subjects: { type: "array", items: { type: "object", required: ["characterId", "wardrobe", "pose", "relation"], properties: { characterId: { type: "string" }, wardrobe: { type: "string" }, pose: { type: "string" }, relation: { type: "string" } } } },
    } } },
  },
} as const;

export function parseProductionPlan(raw: string) {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return productionPlanSchema.parse(JSON.parse(clean));
}

export function validatePlanCanon(plan: ProductionPlan, canon: { characters: Array<{ id: string }>; references: Array<{ id: string; characterIds: string[] }> }) {
  const characters = new Set(canon.characters.map((character) => character.id));
  const references = new Map(canon.references.map((reference) => [reference.id, reference]));
  const voices = new Set(plan.voiceProfiles.map((profile) => profile.speaker));
  const missingSubjectIds: string[] = [];
  for (const shot of plan.shots) {
    const subjectIds = shot.subjects.map((subject) => subject.characterId);
    if (subjectIds.some((id) => !characters.has(id))) throw new Error(`unknown_shot_character:${shot.id}`);
    if (subjectIds.some((id) => ![...references.values()].some((reference) => reference.characterIds.includes(id)))) throw new Error(`identity_reference_mismatch:${shot.id}`);
    if (shot.spokenLines.some((line) => !voices.has(line.speaker))) throw new Error(`voice_profile_missing:${shot.id}`);
    for (const field of ["storyEvent", "frame", "action"] as const) {
      if (subjectIds.some((id) => !shot[field].toLowerCase().includes(id.toLowerCase()))) missingSubjectIds.push(`${shot.id}.${field}`);
    }
  }
  if (missingSubjectIds.length) throw new Error(`subject_id_missing:${missingSubjectIds.join(",")}`);
  return plan;
}
