import type { CharacterProfile } from "../tools/set-identity.ts";
import { PetVideoSpecialist } from "./pet.ts";

const specialists = [new PetVideoSpecialist()];

export function selectVideoSpecialist(characters: CharacterProfile[]) {
  return specialists.find((specialist) => specialist.supports(characters));
}

export function getVideoSpecialist(kind?: string) {
  return specialists.find((specialist) => specialist.kind === kind);
}
