import { createBasicIdentity, type CharacterProfile } from "../identity.ts";
import { publicProjectState, runTool, saveProject, type LocalVideoProject } from "../project.ts";

export async function setIdentityTool(project: LocalVideoProject, subjectKind: CharacterProfile["subjectKind"]) {
  if (project.stage !== "collecting") throw new Error("set_identity_not_allowed");
  return runTool(project, "set_identity", async () => {
    const identity = createBasicIdentity(project.sourcePath, subjectKind);
    project.characters = identity.characters;
    project.referenceAssets = identity.references;
    project.versions.identity = (project.versions.identity ?? 0) + 1;
    project.stage = "identity_ready";
    await saveProject(project);
    return { status: "ready", identityVersion: project.versions.identity, state: publicProjectState(project) };
  });
}
