import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTextSession } from "../../runtime/session.ts";
import { assertCurrentInputs, type VideoProject } from "../../store/index.ts";

const skillPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "SKILL.md");

export function validateDelivery(raw: string) {
  const speech = raw.split("\n").filter((line) => /^SPEECH:\s*/i.test(line));
  if (!speech.length) throw new Error("delivery_speech_missing");
  const words = speech.flatMap((line) => (line.split("|")[1] ?? "").match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? []);
  if (words.length > 32) throw new Error(`delivery_speech_too_long:${words.length}`);
  return raw;
}

export function writeDelivery(project: VideoProject, storyId: string, hookId: string, focus = "") {
  assertCurrentInputs(project, [["story", storyId], ["hook", hookId]]);
  return runTextSession({ project, operation: "delivery-writing", slot: "delivery", skillPath, inputArtifactIds: [storyId, hookId], focus, prepareContent: validateDelivery });
}
