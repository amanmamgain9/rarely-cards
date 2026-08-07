import type { CharacterProfile } from "../identity.ts";
import { GenericVideoPlanner } from "./generic.ts";
import { PetVideoPlanner } from "./pet.ts";
import type { PlannerKind, VideoPlanner } from "./types.ts";

const planners: Record<PlannerKind, VideoPlanner> = {
  pet: new PetVideoPlanner(),
  generic: new GenericVideoPlanner(),
};

export function selectVideoPlanner(characters: CharacterProfile[]) {
  return planners[characters[0]?.subjectKind === "pet" ? "pet" : "generic"];
}

export function getVideoPlanner(kind: PlannerKind) {
  return planners[kind];
}

export type { PlannerKind, VideoPlanner } from "./types.ts";
