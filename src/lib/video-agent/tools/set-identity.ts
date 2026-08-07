import { z } from "zod";
import { publicProjectState, runTool, saveProject, type LocalVideoProject } from "../state.ts";

export const characterProfileSchema = z.object({
  id: z.string().trim().min(1).max(40),
  role: z.enum(["primary_subject", "supporting_subject"]),
  subjectKind: z.string().trim().min(1).max(40),
  displayName: z.string().trim().max(80).optional(),
  physicalDescription: z.string().trim().max(80).refine((value) => value.split(/\s+/).filter(Boolean).length <= 8, "Use at most eight words.").optional(),
  immutableTraits: z.array(z.string().trim().min(2).max(60)).max(3),
  defaultAccessories: z.array(z.string().trim().min(2).max(100)).max(6),
  identityReferenceId: z.string().trim().min(1).max(40),
});

export const referenceAssetSchema = z.object({
  id: z.string().trim().min(1).max(40),
  kind: z.enum(["upload", "generated", "edited"]),
  uri: z.string().trim().min(1),
  characterIds: z.array(z.string().trim().min(1).max(40)),
  parentReferenceId: z.string().trim().min(1).max(40).optional(),
  planVersion: z.number().int().min(0),
  status: z.enum(["missing", "running", "ready", "failed"]),
});

export type CharacterProfile = z.infer<typeof characterProfileSchema>;
export type ReferenceAsset = z.infer<typeof referenceAssetSchema>;

export function createBasicIdentity(
  sourcePath: string,
  subjectKind: CharacterProfile["subjectKind"] = "subject",
  physicalDescription = "",
  immutableTraits: string[] = [],
) {
  const characterId = "character_1";
  const referenceId = "identity_1";
  return {
    characters: [characterProfileSchema.parse({
      id: characterId,
      role: "primary_subject",
      subjectKind,
      physicalDescription,
      immutableTraits,
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
  return `${character.id}: exact subject from ${character.identityReferenceId}. Reference pixels override text; never reconstruct identity from a category label.`;
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

export async function setIdentityTool(
  project: LocalVideoProject,
  subjectKind: CharacterProfile["subjectKind"],
  physicalDescription: string,
  immutableTraits: string[],
) {
  if (project.stage !== "collecting") throw new Error("set_identity_not_allowed");
  return runTool(project, "set_identity", async () => {
    const identity = createBasicIdentity(project.sourcePath, subjectKind, physicalDescription, immutableTraits);
    project.characters = identity.characters;
    project.referenceAssets = identity.references;
    project.versions.identity = (project.versions.identity ?? 0) + 1;
    project.stage = "identity_ready";
    await saveProject(project);
    return { status: "ready", identityVersion: project.versions.identity, state: publicProjectState(project) };
  });
}
