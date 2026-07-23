export type PetFeatureKey =
  | "aura"
  | "sceneLore"
  | "drama"
  | "gaze";

export type PetRatingParameter = {
  key: PetFeatureKey;
  name: string;
  ratingFocus: string;
  labelExamples: readonly string[];
};

export const PET_RATING_PARAMETERS: readonly PetRatingParameter[] = [
  {
    key: "aura",
    name: "Aura",
    ratingFocus:
      "The overall atmosphere the pet brings to this exact moment — confident, tender, suspicious, delighted, sleepy, chaotic, expectant, or completely content.",
    labelExamples: [
      "Bright Expectancy",
      "Quiet Authority",
      "Restless Delight",
      "Complete Contentment",
    ],
  },
  {
    key: "sceneLore",
    name: "Scene Lore",
    ratingFocus:
      "The pet's apparent role in relation to a certain visible place or object — waiting, claiming, helping, interrupting, watching, guarding, or preparing.",
    labelExamples: [
      "Ready At The Threshold",
      "Window Under Watch",
      "Blanket Fully Claimed",
      "Center Of The Room",
    ],
  },
  {
    key: "drama",
    name: "Drama",
    ratingFocus:
      "How strongly the pet's face, ears, mouth, pose, or movement reacts to the small visible situation — from quietly content to treating one missing snack like a major event.",
    labelExamples: [
      "Patience Running Thin",
      "Tiny Stakes, Huge Feelings",
      "Calm Despite Everything",
      "Moment Fully Escalated",
    ],
  },
  {
    key: "gaze",
    name: "Gaze",
    ratingFocus:
      "What the pet's visible eyes seem to be saying and what has their attention — asking, trusting, judging, hoping, tracking, daydreaming, or refusing to look away.",
    labelExamples: [
      "Fixed On You",
      "Tracking Every Move",
      "Watching The Distance",
      "Soft Unbroken Focus",
    ],
  },
] as const;

export const PET_DEMO_RESULT = {
  petName: "Mabel",
  pronouns: "they" as const,
  species: "dog" as const,
  energy: "playful" as const,
  cardTitle: "Flower Delivery",
  rarityScore: 83,
  signatureRead: {
    title: "This Is For You",
    score: 96,
    thought:
      "I am holding this flower very carefully, so please understand that it is obviously for you.",
  },
  ratings: [
    {
      key: "aura" as const,
      label: "Aura",
      score: 85,
      phrase: "Bright Expectancy",
      reason: "Mabel stands calmly with the flower held forward.",
    },
    {
      key: "sceneLore" as const,
      label: "Scene Lore",
      score: 94,
      phrase: "Delivery In Progress",
      reason: "The flower points toward the camera like an offering.",
    },
    {
      key: "drama" as const,
      label: "Drama",
      score: 91,
      phrase: "Reaction Required Immediately",
      reason: "Mabel's open mouth and forward stance make the moment feel urgent.",
    },
    {
      key: "gaze" as const,
      label: "Gaze",
      score: 80,
      phrase: "Fixed On You",
      reason: "Mabel looks directly toward the camera.",
    },
  ],
  fieldNote:
    "The flower arrives with more urgency than the situation requires.",
  inscription:
    "Mabel holds one flower forward with careful, hopeful focus. It feels less like something found and more like something chosen for you.",
} as const;
