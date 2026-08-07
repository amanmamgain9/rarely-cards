import { assertPlanPreservesTreatment, type VideoPlan, type VideoTreatment } from "./schemas.ts";

export type PlanDiagnostic = {
  code: "dialogue_may_feel_rushed";
  sceneId: string;
  message: string;
};

export function validatePlanStructure(treatment: VideoTreatment, plan: VideoPlan) {
  assertPlanPreservesTreatment(treatment, plan);
  const treatmentBeatIds = new Set(treatment.beats.map((beat) => beat.id));
  const plannedBeatIds = new Set(plan.scenes.flatMap((scene) => scene.beatIds));
  if ([...treatmentBeatIds].some((id) => !plannedBeatIds.has(id))) throw new Error("video_plan_missing_treatment_beat");
  if ([...plannedBeatIds].some((id) => !treatmentBeatIds.has(id))) throw new Error("video_plan_invented_treatment_beat");
}

export function inspectPlan(plan: VideoPlan): PlanDiagnostic[] {
  return plan.scenes.flatMap((scene) => {
    const words = scene.spokenLines.reduce((total, speech) => total + speech.line.split(/\s+/).filter(Boolean).length, 0);
    const seconds = scene.endSeconds - scene.startSeconds;
    return words > seconds * 2.5
      ? [{ code: "dialogue_may_feel_rushed" as const, sceneId: scene.id, message: `${words} spoken words in ${seconds.toFixed(1)} seconds.` }]
      : [];
  });
}
