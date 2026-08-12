import { artifact, type ArtifactSlot, type VideoProject } from "../store/index.ts";
import { compileVideo } from "./compile-video/index.ts";
import { createStory } from "./create-story/index.ts";
import { createVisualHook } from "./create-visual-hook/index.ts";
import { writeDelivery } from "./write-delivery/index.ts";

export function videoTools({ project }: { project: VideoProject }) {
  const retries = new Map<ArtifactSlot, number>();
  const attempted = new Set<ArtifactSlot>();
  const order: ArtifactSlot[] = ["story", "hook", "delivery", "plan", "video"];
  function resetDownstream(slot: ArtifactSlot) {
    for (const downstream of order.slice(order.indexOf(slot) + 1)) {
      attempted.delete(downstream);
      retries.delete(downstream);
    }
  }
  function retry(slot: ArtifactSlot, focus: string) {
    const isRetry = attempted.has(slot) || Boolean(project.current[slot]);
    if (!isRetry && focus) throw new Error(`retry_focus_without_attempt:${slot}`);
    if (isRetry && !focus) throw new Error(`retry_focus_required:${slot}`);
    attempted.add(slot);
    if (!focus) return;
    const count = retries.get(slot) ?? 0;
    if (count >= 2) throw new Error(`retry_cap_reached:${slot}`);
    retries.set(slot, count + 1);
  }
  return {
    index() {
      return { current: { ...project.current }, artifacts: project.artifacts.map(({ id, slot, version, inputArtifactIds }) => ({ id, slot, version, inputArtifactIds })) };
    },
    readArtifact(id: string) {
      return artifact(project, id);
    },
    finishTarget(id: string, slot: ArtifactSlot, readIds: Set<string>) {
      const item = artifact(project, id, slot);
      if (project.current[slot] !== item.id || !readIds.has(item.id)) throw new Error("director_finish_requires_current_read_artifact");
      return item;
    },
    async createStory(focus = "") {
      retry("story", focus);
      const created = await createStory(project, focus);
      resetDownstream("story");
      return created;
    },
    async createVisualHook(storyId: string, focus = "") {
      retry("hook", focus);
      const created = await createVisualHook(project, storyId, focus);
      resetDownstream("hook");
      return created;
    },
    async writeDelivery(storyId: string, hookId: string, focus = "") {
      retry("delivery", focus);
      const created = await writeDelivery(project, storyId, hookId, focus);
      resetDownstream("delivery");
      return created;
    },
    async compileVideo(storyId: string, hookId: string, deliveryId: string, focus = "") {
      retry("plan", focus);
      const created = await compileVideo(project, storyId, hookId, deliveryId, focus);
      resetDownstream("plan");
      return created;
    },
    async generateVideo(planId: string, deliveryId: string, spendGrantId: string, userId: string, generationId: string) {
      const { generateVideo } = await import("./generate-video/index.ts");
      return generateVideo({ project, planId, deliveryId, spendGrantId, userId, generationId });
    },
  };
}

export type { VideoProject } from "../store/index.ts";
