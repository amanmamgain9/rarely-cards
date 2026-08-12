import { writeFile } from "node:fs/promises";
import path from "node:path";
import { artifact, type VideoProject } from "../../store/index.ts";
import { parseProductionPlan } from "../compile-video/schema.ts";

export function buildVideoPrompt(project: VideoProject, planId: string, deliveryId: string) {
  const plan = parseProductionPlan(artifact(project, planId, "plan").content);
  artifact(project, deliveryId, "delivery");
  if (!project.canon) throw new Error("canon_missing");
  const referenceMap = project.canon.references.map((reference, index) => {
    const role = reference.role === "character"
      ? `identity only for ${reference.characterIds.join(", ")}`
      : reference.role === "environment" ? "environment only; never copy subjects or interface from it"
        : reference.role === "interface" ? "screen composition and UI layout only; never copy subjects from it"
          : reference.role === "production" ? "integrated composition, setting, and interface only; never copy subjects from it"
            : "visual style only; never copy subjects or layout";
    return `Reference image ${index + 1}: ${role}. ${reference.description}`;
  }).join("\n");
  const shots = plan.shots.map((shot) => [
    `${shot.startSeconds}-${shot.endSeconds}s: ${shot.storyEvent}`,
    `Frame: ${shot.frame}`,
    `Visible action: ${shot.action}`,
    `Camera: ${shot.camera}`,
    shot.subjects.length ? `Continuity: ${shot.subjects.map((subject) => `${subject.characterId}, wardrobe ${subject.wardrobe}, ${subject.relation}`).join(" | ")}` : "",
    shot.spokenLines.length ? `Speech: ${shot.spokenLines.map((line) => `${line.speaker}: “${line.line}” (${line.performance})`).join(" | ")}` : "",
    shot.sound ? `Sound: ${shot.sound}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");
  return [
    `Create one coherent ${plan.durationSeconds}-second vertical 9:16 video with generated audio.`,
    `REFERENCE MAP\n${referenceMap}`,
    "Keep reference roles separate. Character references own identity; other references own only their mapped production role and never introduce characters.",
    shots,
    `Identity continuity: preserve every referenced character exactly across all shots. ${plan.continuity}`,
    `Music: ${plan.music}`,
    `Voice lock: ${plan.voiceProfiles.map(({ speaker, voice }) => `${speaker}: ${voice}`).join(" | ")}`,
    "Execute every event causally and visibly. Speak each supplied line exactly once with one stable voice per speaker. Add no new plot, prop, obstacle, solution, ending, or speech. No captions, subtitles, logos, or watermarks. Show only game HUD or title text explicitly required by timed shot directions.",
  ].join("\n\n");
}

export async function saveVideoPrompt(project: VideoProject, planId: string, deliveryId: string) {
  const outputPath = path.join(project.outputDir, "seedance-prompt.txt");
  await writeFile(outputPath, `${buildVideoPrompt(project, planId, deliveryId)}\n`);
  return outputPath;
}
