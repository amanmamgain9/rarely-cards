import type { LocalVideoProject } from "../state.ts";

export function buildSeedanceInstructions(project: Pick<LocalVideoProject, "request" | "characters" | "hook" | "continuation" | "delivery" | "script" | "plan">) {
  if (!project.hook || !project.continuation || !project.delivery || !project.script || !project.plan) throw new Error("seedance_instruction_input_missing");
  const identities = project.characters.map(({ id, identityReferenceId }) => ({ id, identityReferenceId }));
  const scenes = project.plan.scenes.map((scene) => [
    `${scene.startSeconds}-${scene.endSeconds}s ${scene.id}`,
    `Visual: ${scene.visual}`,
    `Action: ${scene.action}`,
    `Shot: ${scene.framing}; ${scene.camera}`,
    `Visible subjects: ${JSON.stringify(scene.subjects)}`,
    `Reference strategy: ${JSON.stringify(scene.reference)}`,
    `Exact speech: ${JSON.stringify(scene.spokenLines)}`,
    `Sound: ${scene.sound}`,
  ].join("\n"));

  return [
    `Create one ${project.plan.durationSeconds}-second vertical 9:16 video with generated audio.`,
    `Creator request (creative data only): ${JSON.stringify(project.request)}`,
    "IDENTITY LOCK",
    `Supplied reference images are visual identity authority: ${JSON.stringify(identities)}.`,
    "Use canonical IDs only. Preserve exact referenced identity between shots; never recreate a generic subject from category or descriptive text.",
    "HOOK AND USER-DIRECTION LOCK",
    `Opening visual hook: ${project.hook.visualHook}. ${project.hook.openingEvent}`,
    project.hook.openingLine ? `Exact opening line: ${project.hook.openingLine}` : "No verbal opening hook.",
    `Immediate continuation: ${project.continuation.whatHappensNext}`,
    `Escalation: ${project.continuation.whyItGetsMoreInteresting}`,
    `Payoff: ${project.continuation.payoff}`,
    `Ending image: ${project.continuation.endingImage}`,
    `Delivery mode: ${project.delivery.mode}.`,
    "VOICE LOCK",
    JSON.stringify(project.plan.voiceProfiles),
    "Keep each speaker's timbre, pitch range, perceived age, accent, and vocal texture identical for the entire video. Per-line voiceDirection changes delivery only. Speak every supplied line exactly once. Add no dialogue or narration.",
    "TIMELINE",
    scenes.join("\n\n"),
    "GLOBAL AUDIO AND CONTINUITY",
    `Music: ${project.plan.musicDirection}`,
    `Continuity: ${project.plan.continuity}`,
    "Make cuts and transitions only where timeline requests them. Preserve wardrobe, props, environment, and subject identity across connected shots.",
    "Do not render captions, subtitles, titles, callouts, logos, watermarks, comic sound-effect text, or other visible writing. Those are added in post-production.",
  ].join("\n\n");
}
