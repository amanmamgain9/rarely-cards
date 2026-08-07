import type { CharacterProfile, ReferenceAsset } from "./identity.ts";
import type { VideoPlan } from "./schemas.ts";

export function validatePlanIdentity({
  characters,
  referenceAssets,
  plan,
}: {
  characters: CharacterProfile[];
  referenceAssets: ReferenceAsset[];
  plan: VideoPlan;
}) {
  const characterIds = new Set(characters.map((character) => character.id));
  if (characterIds.size !== characters.length) throw new Error("duplicate_character_id");
  const references = new Map(referenceAssets.map((reference) => [reference.id, reference]));
  if (references.size !== referenceAssets.length) throw new Error("duplicate_reference_id");

  for (const character of characters) {
    const identityReference = references.get(character.identityReferenceId);
    if (!identityReference || !identityReference.characterIds.includes(character.id)) {
      throw new Error(`character_identity_reference_missing:${character.id}`);
    }
  }

  for (const scene of plan.scenes) {
    const sceneCharacterIds = scene.subjects.map((subject) => subject.characterId);
    if (new Set(sceneCharacterIds).size !== sceneCharacterIds.length) {
      throw new Error(`duplicate_scene_character:${scene.id}`);
    }
    if (sceneCharacterIds.some((id) => !characterIds.has(id))) {
      throw new Error(`unknown_scene_character:${scene.id}`);
    }
    const identityReference = references.get(scene.reference.identityReferenceId);
    if (!identityReference) throw new Error(`unknown_identity_reference:${scene.id}`);
    if (sceneCharacterIds.some((id) => !identityReference.characterIds.includes(id))) {
      throw new Error(`identity_reference_character_mismatch:${scene.id}`);
    }
  }
}

export function validateReferenceLineage(referenceAssets: ReferenceAsset[]) {
  const references = new Map(referenceAssets.map((reference) => [reference.id, reference]));
  if (references.size !== referenceAssets.length) throw new Error("duplicate_reference_id");

  for (const reference of referenceAssets) {
    if (reference.kind === "upload" && reference.parentReferenceId) {
      throw new Error(`upload_reference_has_parent:${reference.id}`);
    }
    if (reference.kind !== "upload" && !reference.parentReferenceId) {
      throw new Error(`generated_reference_missing_parent:${reference.id}`);
    }
    const seen = new Set([reference.id]);
    let parentId = reference.parentReferenceId;
    while (parentId) {
      if (seen.has(parentId)) throw new Error(`reference_cycle:${reference.id}`);
      seen.add(parentId);
      const parent = references.get(parentId);
      if (!parent) throw new Error(`reference_parent_missing:${reference.id}`);
      parentId = parent.parentReferenceId;
    }
  }
}
