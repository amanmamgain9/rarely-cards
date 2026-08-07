import type { CharacterProfile } from "../identity.ts";
import type { Hook, VideoTreatment } from "../schemas.ts";

export type PlannerKind = "pet" | "generic";

export type PlannerContext = {
  request: string;
  characters: CharacterProfile[];
  hook?: Hook;
  treatment?: VideoTreatment;
};

export interface VideoPlanner {
  readonly kind: PlannerKind;
  hookPrompt(context: PlannerContext): string;
  treatmentPrompt(context: PlannerContext): string;
  readonly refinementBrief: string;
  designPrompt(context: PlannerContext): string;
}
