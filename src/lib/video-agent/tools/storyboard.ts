import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { describeCharacter, referenceAssetSchema, resolveSceneSubjects } from "../identity.ts";
import { validateReferenceLineage } from "../identity-validation.ts";
import { generateReferenceImage, preparedJpeg } from "../model.ts";
import { publicProjectState, runTool, saveProject, type LocalVideoProject, type StoryboardArtifact } from "../project.ts";

async function originalFrame(source: Buffer) {
  return sharp(source).rotate().resize(941, 1672, { fit: "cover", position: "attention" }).png().toBuffer();
}

async function createContactSheet(artifacts: StoryboardArtifact[], outputPath: string) {
  const cells = await Promise.all(artifacts.map(async (artifact) => sharp(await readFile(artifact.path)).resize(360, 640, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer()));
  const width = artifacts.length === 1 ? 400 : 800;
  const rows = Math.ceil(artifacts.length / 2);
  await sharp({ create: { width, height: rows * 680, channels: 3, background: "#111111" } })
    .composite(cells.map((input, index) => ({ input, left: artifacts.length === 1 ? 20 : 20 + (index % 2) * 400, top: 20 + Math.floor(index / 2) * 680 })))
    .jpeg({ quality: 90 })
    .toFile(outputPath);
}

export async function renderStoryboardTool(project: LocalVideoProject, ai: GoogleGenAI, model: string, source: Buffer, planVersion: number) {
  if (project.stage !== "planned" || project.versions.plan !== planVersion || !project.plan) throw new Error("render_storyboard_not_allowed");
  project.stage = "storyboard_rendering";
  await saveProject(project);
  try {
    return await runTool(project, "render_storyboard", async () => {
      const storyboardDir = path.join(project.outputDir, "storyboard");
      await mkdir(storyboardDir, { recursive: true });
      const artifacts = new Map<string, StoryboardArtifact>();
      for (const artifact of project.storyboard.filter((candidate) => candidate.planVersion === planVersion)) {
        try {
          await access(artifact.path);
          artifacts.set(artifact.sceneId, artifact);
        } catch {}
      }
    const primaryCharacter = project.characters[0];
    if (!primaryCharacter) throw new Error("primary_character_missing");
    for (const [index, scene] of project.plan!.scenes.entries()) {
      const outputPath = path.join(storyboardDir, `${String(index + 1).padStart(2, "0")}-${scene.id}.png`);
      if (artifacts.has(scene.id)) continue;
      const parentArtifact = scene.reference.kind === "edit" ? artifacts.get(scene.reference.fromSceneId) : undefined;
      if (scene.reference.kind === "edit" && !parentArtifact) throw new Error("storyboard_parent_missing");
      const buffer = scene.reference.kind === "original"
        ? await originalFrame(source)
        : await generateReferenceImage({
          ai, model, source,
          parent: parentArtifact ? await preparedJpeg(parentArtifact.path) : undefined,
          request: project.request,
          plan: project.plan!,
          scene,
          identity: describeCharacter(primaryCharacter),
          subjects: resolveSceneSubjects(scene.subjects, project.characters),
        });
      await writeFile(outputPath, buffer);
      const referenceId = scene.reference.kind === "original" ? scene.reference.identityReferenceId : `ref_${scene.id}`;
      artifacts.set(scene.id, {
        sceneId: scene.id,
        referenceId,
        path: outputPath,
        source: scene.reference.kind === "original" ? "original" : scene.reference.kind === "edit" ? "edited" : "generated",
        planVersion,
      });
      if (scene.reference.kind !== "original") {
        const parentReferenceId = scene.reference.kind === "edit"
          ? artifacts.get(scene.reference.fromSceneId)?.referenceId
          : scene.reference.identityReferenceId;
        project.referenceAssets = [
          ...project.referenceAssets.filter((reference) => reference.id !== referenceId),
          referenceAssetSchema.parse({
            id: referenceId,
            kind: scene.reference.kind === "edit" ? "edited" : "generated",
            uri: outputPath,
            characterIds: [...new Set(scene.subjects.map((subject) => subject.characterId))],
            parentReferenceId,
            planVersion,
            status: "ready",
          }),
        ];
        validateReferenceLineage(project.referenceAssets);
      }
      project.storyboard = [...artifacts.values()];
      await saveProject(project);
    }
    await createContactSheet(project.storyboard, path.join(project.outputDir, "storyboard-contact-sheet.jpg"));
    project.stage = "review";
    await saveProject(project);
    return { status: "ready", frameCount: project.storyboard.length, state: publicProjectState(project) };
    });
  } catch (error) {
    project.stage = "planned";
    await saveProject(project);
    throw error;
  }
}
