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
