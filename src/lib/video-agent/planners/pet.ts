import type { CharacterProfile } from "../tools/set-identity.ts";

const PET_VOICE = "as cute and baby-like as possible: tiny, sweet, soft, innocent, affectionate, and expressive, while remaining clear and never shrill or harsh";

export class PetVideoSpecialist {
  readonly kind = "pet" as const;

  supports(characters: CharacterProfile[]) {
    const kind = characters[0]?.subjectKind.toLowerCase() ?? "";
    return ["pet", "dog", "cat", "animal", "bird", "rabbit", "hamster", "horse", "reptile"].includes(kind)
      || kind.endsWith("_pet");
  }

  readonly hookStylingBrief = "Preserve the selected visual premise exactly. Make its surface treatment cute, warm, safe, and pet-scaled. Any invented clothing, accessory, set, or prop must be cozy and charming.";

  readonly voiceBrief = `When the pet speaks, lock its vocal sound once as ${PET_VOICE}. This controls acoustic identity only—not intelligence, vocabulary, syntax, humor, or dramatic writing. Per-line voiceDirection changes only emotion, intensity, or pacing. Nonverbal pet sounds remain tiny, gentle, cute, and baby-like.`;

  readonly designBrief = "Favor cute readable eyes, ears, paws, posture, head tilts, tail movement, and affectionate interaction over human-like gesturing but keep the visual identity of the pet. Keep the muzzle visible during speech. Any generated clothing, accessory, set, or prop must always be unmistakably cute and pet-scaled: soft rounded shapes, tiny proportions, cozy plush textures, cheerful or pastel details, and charming trim where appropriate. Avoid accidental menace, looming angles, horror lighting, or aggressive movement unless explicitly requested.";
}
