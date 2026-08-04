import { z } from "zod";

export const petVoiceAccentSchema = z.enum(["english", "french"]);

export type PetVoiceAccent = z.infer<typeof petVoiceAccentSchema>;

export const DEFAULT_PET_VOICE_ACCENT: PetVoiceAccent = "english";

export const PET_VOICE_ACCENTS: ReadonlyArray<{
  value: PetVoiceAccent;
  label: string;
  sample: string;
  recognitionLanguage: string;
}> = [
  {
    value: "english",
    label: "English",
    sample: "Hello",
    recognitionLanguage: "en-GB",
  },
  {
    value: "french",
    label: "French",
    sample: "Bonjour",
    recognitionLanguage: "fr-FR",
  },
];

export function speechRecognitionLanguage(accent: PetVoiceAccent) {
  return (
    PET_VOICE_ACCENTS.find((option) => option.value === accent)
      ?.recognitionLanguage ?? "en-GB"
  );
}
