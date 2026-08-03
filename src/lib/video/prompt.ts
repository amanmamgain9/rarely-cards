export function buildPetVideoPrompt({
  petName,
  dialogue,
}: {
  petName: string;
  dialogue: string;
}) {
  return [
    `Create one continuous, photorealistic portrait video of ${petName}, the exact pet in the supplied first frame.`,
    "Use restrained, physically natural motion: gentle breathing, a blink, and one subtle head movement.",
    "Begin on the supplied photograph and preserve the exact identity, face shape, fur pattern, markings, eye color, body proportions, accessories, room, lighting, and camera perspective throughout.",
    `The pet looks toward the camera and clearly says exactly: “${dialogue}”`,
    "Synchronize the mouth naturally and precisely to the spoken words. Keep the voice warm, expressive, and believable for this pet; do not add any other speech or narration.",
    "Use one stable close portrait shot with realistic fur and physically natural motion. Keep the original composition readable in a vertical frame.",
    "Natural room tone only behind the dialogue; no captions, text, logos, cuts, scene changes, costume changes, added objects, extra animals, extra limbs, distorted anatomy, exaggerated expression, or camera shake.",
  ].join(" ");
}
