import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describeCharacter, resolveSceneSubjects, type CharacterProfile } from "./identity.ts";
import type { LocalVideoProject, StoryboardArtifact } from "./project.ts";
import { videoPlanSchema, type VideoPlan } from "./schemas.ts";

export const MAX_SEEDANCE_REFERENCE_IMAGES = 9;

export type SeedancePackage = {
  prompt: string;
  references: Array<{ label: string; path: string; role: string }>;
  sceneReferences: Record<string, string>;
};

export function buildSeedancePackage(project: {
  request: string;
  sourcePath: string;
  characters?: CharacterProfile[];
  plan?: VideoPlan;
  storyboard: StoryboardArtifact[];
}): SeedancePackage {
  const plan = videoPlanSchema.parse(project.plan);
  const characters = project.characters ?? [];
  const references: SeedancePackage["references"] = [{ label: "Image1", path: project.sourcePath, role: "original subject identity" }];
  const pathToLabel = new Map([[path.resolve(project.sourcePath), "Image1"]]);
  const sceneReferences: Record<string, string> = {};
  for (const artifact of project.storyboard) {
    const resolved = path.resolve(artifact.path);
    let label = pathToLabel.get(resolved);
    if (!label) {
      label = `Image${references.length + 1}`;
      pathToLabel.set(resolved, label);
      references.push({ label, path: artifact.path, role: `storyboard reference for ${artifact.sceneId}` });
    }
    sceneReferences[artifact.sceneId] = label;
  }
  if (Object.keys(sceneReferences).length !== plan.scenes.length) throw new Error("seedance_storyboard_incomplete");
  if (references.length > MAX_SEEDANCE_REFERENCE_IMAGES) throw new Error("seedance_reference_limit_exceeded");

  const prompt = [
    `Create one coherent ${plan.durationSeconds}-second vertical 9:16 photorealistic video from these approved references.`,
    `[Image1] is the canonical identity reference.${characters[0] ? ` ${describeCharacter(characters[0])}` : ""} Preserve identity independently from scene wardrobe, pose, and expression.`,
    ...plan.scenes.map((scene) => {
      const speech = scene.spokenLines.length
        ? ` AUDIO: ${scene.spokenLines.map((line) => `${line.speaker} says exactly ${JSON.stringify(line.line)} in ${JSON.stringify(line.voiceDirection)}`).join(" Then ")}.`
        : " No speech.";
      const subjects = characters.length ? ` SUBJECTS: ${resolveSceneSubjects(scene.subjects, characters)}` : "";
      return `${scene.startSeconds}–${scene.endSeconds}s use [${sceneReferences[scene.id]}].${subjects} ${scene.visual} ACTION: ${scene.action} CAMERA: ${scene.camera}, motivated only by the action. SOUND: ${scene.sound}.${speech}`;
    }),
    `MUSIC: ${plan.musicDirection} Duck music fully beneath every spoken line.`,
    `CONTINUITY: ${plan.continuity}`,
    "Use decisive hard cuts at scene boundaries. No fade-in, automatic push-in, decorative drift, duplicate subject, extra limbs, captions, logos, watermarks, invented dialogue, or generated title card. End cleanly for local finishing.",
  ].join(" ");
  if (prompt.length > 4000) throw new Error("seedance_prompt_too_long");
  return { prompt, references, sceneReferences };
}

export async function exportSeedancePackage(project: LocalVideoProject) {
  const output = buildSeedancePackage(project);
  await Promise.all([
    writeFile(path.join(project.outputDir, "seedance-prompt.txt"), `${output.prompt}\n`),
    writeFile(path.join(project.outputDir, "seedance-manifest.json"), `${JSON.stringify({
      model: "dreamina-seedance-2-0-mini-260615",
      duration: project.plan?.durationSeconds,
      resolution: "720p",
      aspectRatio: "9:16",
      generateAudio: true,
      submitted: false,
      ...output,
    }, null, 2)}\n`),
  ]);
}
