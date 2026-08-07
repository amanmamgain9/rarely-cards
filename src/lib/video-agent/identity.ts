import { z } from "zod";

export const characterProfileSchema = z.object({
  id: z.string().trim().min(1).max(40),
  role: z.enum(["primary_pet", "primary_person", "primary_product", "primary_subject", "supporting_subject"]),
  subjectKind: z.enum(["pet", "person", "product", "other"]),
  displayName: z.string().trim().max(80).optional(),
  physicalDescription: z.string().trim().max(500).optional(),
  immutableTraits: z.array(z.string().trim().min(2).max(120)).max(10),
  defaultAccessories: z.array(z.string().trim().min(2).max(100)).max(6),
  voiceDescription: z.string().trim().max(240).optional(),
  identityReferenceId: z.string().trim().min(1).max(40),
});

export const referenceAssetSchema = z.object({
  id: z.string().trim().min(1).max(40),
  kind: z.enum(["upload", "generated", "edited"]),
  uri: z.string().trim().min(1),
  characterIds: z.array(z.string().trim().min(1).max(40)).min(1),
  parentReferenceId: z.string().trim().min(1).max(40).optional(),
  planVersion: z.number().int().min(0),
  status: z.enum(["missing", "running", "ready", "failed"]),
});

export type CharacterProfile = z.infer<typeof characterProfileSchema>;
export type ReferenceAsset = z.infer<typeof referenceAssetSchema>;

export function createBasicIdentity(sourcePath: string, subjectKind: CharacterProfile["subjectKind"] = "pet") {
  const characterId = "char_primary";
  const referenceId = "ref_original";
  const role = subjectKind === "pet" ? "primary_pet"
    : subjectKind === "person" ? "primary_person"
      : subjectKind === "product" ? "primary_product"
        : "primary_subject";
  return {
    characters: [characterProfileSchema.parse({
      id: characterId,
      role,
      subjectKind,
      immutableTraits: [],
      defaultAccessories: [],
      identityReferenceId: referenceId,
    })],
    references: [referenceAssetSchema.parse({
      id: referenceId,
      kind: "upload",
      uri: sourcePath,
      characterIds: [characterId],
      planVersion: 0,
      status: "ready",
    })],
  };
}

export function describeCharacter(character: CharacterProfile) {
  return [
    character.displayName || (character.role === "primary_pet" ? "the primary pet" : "the primary subject"),
    character.physicalDescription,
    character.immutableTraits.length ? `Identity traits: ${character.immutableTraits.join(", ")}.` : "",
    character.defaultAccessories.length ? `Default accessories: ${character.defaultAccessories.join(", ")}.` : "",
    `Identity is defined by ${character.identityReferenceId}.`,
  ].filter(Boolean).join(" ");
}

export function resolveSceneSubjects(
  subjects: Array<{
    characterId: string;
    visibleDescription: string;
    wardrobe: string;
    positionOrRelation: string;
    expressionOrPose: string;
  }>,
  characters: CharacterProfile[],
) {
  return subjects.map((subject) => {
    const character = characters.find((candidate) => candidate.id === subject.characterId);
    if (!character) throw new Error(`unknown_scene_character:${subject.characterId}`);
    return [
      `${character.id}: ${describeCharacter(character)}`,
      `Scene appearance: ${subject.visibleDescription}.`,
      subject.wardrobe ? `Scene wardrobe: ${subject.wardrobe}.` : "",
      subject.positionOrRelation ? `Position: ${subject.positionOrRelation}.` : "",
      subject.expressionOrPose ? `Expression or pose: ${subject.expressionOrPose}.` : "",
    ].filter(Boolean).join(" ");
  }).join(" | ");
}
