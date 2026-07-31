import type { AcceptedAnalysis } from "@/lib/analysis/types";

const ENERGY_DIRECTION: Record<string, string> = {
  regal: "a composed blink and a small, self-assured lift of the chin",
  goofy: "a curious blink followed by one small, naturally funny head tilt",
  chaotic: "an alert glance and a quick but physically natural head movement",
  serene: "slow breathing, a soft blink, and an almost imperceptible head turn",
  eager: "bright attentive eyes and a gentle lean toward the camera",
  curious: "a focused sideways glance followed by a subtle head tilt",
  playful: "an inviting look and one restrained, playful movement",
  sleepy: "slow breathing, heavy eyelids, and one quiet sleepy blink",
};

export function buildPetVideoPrompt(result: AcceptedAnalysis, dialogue: string) {
  const petName = result.petName || "the pet";
  const species = result.species || "pet";
  const movement =
    ENERGY_DIRECTION[result.energy || ""] ||
    "a natural blink and one subtle head movement";

  return [
    `Create one continuous, photorealistic portrait video of ${petName}, the exact ${species} in the supplied first frame.`,
    `The performance is restrained: ${movement}.`,
    "Begin on the supplied photograph and preserve the exact identity, face shape, fur pattern, markings, eye color, body proportions, accessories, room, lighting, and camera perspective throughout.",
    `The pet looks toward the camera and clearly says exactly: “${dialogue}”`,
    "Synchronize the mouth naturally and precisely to the spoken words. Keep the voice warm, expressive, and believable for this pet; do not add any other speech or narration.",
    "Use one stable close portrait shot with realistic fur and physically natural motion. Keep the original composition readable in a vertical frame.",
    "Natural room tone only behind the dialogue; no captions, text, logos, cuts, scene changes, costume changes, added objects, extra animals, extra limbs, distorted anatomy, exaggerated expression, or camera shake.",
  ].join(" ");
}
