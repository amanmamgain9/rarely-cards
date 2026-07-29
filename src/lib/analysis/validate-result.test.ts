import { describe, expect, it } from "vitest";
import {
  acceptedAnalysisSchema,
  analysisResultSchema,
  petEnergySchema,
} from "@/lib/analysis/types";
import { validateAnalysisContract } from "@/lib/analysis/validate-result";
import { PET_RATING_PARAMETERS } from "@/lib/rarity/pet-config";
import {
  calculateRarityScore,
  getRarityTier,
} from "@/lib/rarity/score";

function acceptedResult({
  petName = "Miso",
  species = "cat",
  pronouns = "they",
}: {
  petName?: string;
  species?: "cat" | "dog";
  pronouns?: "he" | "she" | "they";
} = {}) {
  const scores = [84, 94, 86, 80];
  const ratings = PET_RATING_PARAMETERS.map((parameter, index) => ({
    key: parameter.key,
    label: parameter.name,
    score: scores[index],
    phrase: `${parameter.name} read`,
    reason: `Visible evidence for ${parameter.name.toLowerCase()}.`,
  }));
  return acceptedAnalysisSchema.parse({
    status: "accepted",
    petName,
    pronouns,
    species,
    energy: "serene",
    cardTitle: "Heir to the Afternoon",
    rarityScore: 81,
    signatureRead: {
      title: "Keeping This Warm",
      score: 97,
      thought:
        "This warm window has exactly one good seat, and I have already found it.",
    },
    ratings,
    fieldNote: "The warm spot appears to have found its intended occupant.",
    inscription:
      `Light reaches the edge of ${petName}'s ears first. The soft stare makes one warm square feel like the best place to be.`,
  });
}

describe("analysis result validation", () => {
  it("uses only the four owner-facing ratings in card order", () => {
    expect(
      PET_RATING_PARAMETERS.map(({ key, name }) => [key, name]),
    ).toEqual([
      ["aura", "Aura"],
      ["sceneLore", "Scene Lore"],
      ["drama", "Drama"],
      ["gaze", "Gaze"],
    ]);
  });

  it.each(petEnergySchema.options)("accepts the %s energy register", (energy) => {
    const result = acceptedResult();
    if (result.status !== "accepted") throw new Error("test setup failed");
    expect(
      validateAnalysisContract(
        { ...result, energy },
        "pet",
        "Miso",
        "they",
      ).status,
    ).toBe("accepted");
  });

  it("accepts the exact pet rating and writing contract", () => {
    expect(
      validateAnalysisContract(acceptedResult(), "pet", "Miso", "they").status,
    ).toBe("accepted");
  });

  it("accepts the same grounded contract for a dog", () => {
    expect(
      validateAnalysisContract(
        acceptedResult({
          petName: "Pepper",
          species: "dog",
          pronouns: "she",
        }),
        "pet",
        "Pepper",
        "she",
      ).status,
    ).toBe("accepted");
  });

  it.each([
    "no_pet",
    "multiple_pets",
    "unsupported_subject",
    "too_blurry",
    "too_obscured",
    "pet_too_small",
  ] as const)("passes a %s rejection without invented scores", (reason) => {
    const rejected = analysisResultSchema.parse({
      status: "rejected",
      reason,
      message: "Choose a photo where one cat or dog owns the frame.",
    });
    expect(validateAnalysisContract(rejected, "pet", "Miso")).toEqual(rejected);
  });

  it("rejects reordered or incomplete ratings", () => {
    const result = acceptedResult();
    if (result.status !== "accepted") throw new Error("test setup failed");
    const reordered = {
      ...result,
      ratings: [...result.ratings].reverse(),
    };
    expect(() =>
      validateAnalysisContract(reordered, "pet", "Miso", "they"),
    ).toThrow(
      "invalid_model_schema",
    );
  });

  it("keeps the signature read independent from every rating score", () => {
    const result = acceptedResult();
    if (result.status !== "accepted") throw new Error("test setup failed");
    expect(
      validateAnalysisContract(
        {
          ...result,
          signatureRead: {
            title: "One More Quiet Minute",
            score: 99,
            thought:
              "I am watching the last light, and I would like one more quiet minute with it.",
          },
        },
        "pet",
        "Miso",
        "they",
      ).status,
    ).toBe("accepted");
  });

  it("allows a close narrative read when inner voice would be forced", () => {
    const result = acceptedResult();
    if (result.status !== "accepted") throw new Error("test setup failed");
    expect(
      validateAnalysisContract(
        {
          ...result,
          signatureRead: {
            ...result.signatureRead,
            title: "Room Waiting Quietly",
            thought:
              "With Miso turned toward the window, the last warm patch makes the whole room wait with them.",
          },
        },
        "pet",
        "Miso",
        "they",
      ).status,
    ).toBe("accepted");
  });

  it("rejects a name mismatch or missing emotional card copy", () => {
    const result = acceptedResult();
    expect(() =>
      validateAnalysisContract(result, "pet", "Pepper", "they"),
    ).toThrow("invalid_model_schema");
    expect(() =>
      validateAnalysisContract(result, "pet", "Miso", "she"),
    ).toThrow("invalid_model_schema");
    expect(() =>
      validateAnalysisContract(
        {
          ...result,
          inscription:
            "The light reaches his ears first. That small detail holds the frame together.",
        },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");
    expect(() =>
      validateAnalysisContract(
        { ...result, inscription: undefined },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");
    expect(() =>
      validateAnalysisContract(
        { ...result, energy: undefined },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");
    expect(() =>
      validateAnalysisContract(
        {
          ...result,
          ratings: result.ratings.map((rating, index) =>
            index === 0 ? { ...rating, phrase: "I Am Waiting" } : rating,
          ),
        },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");
  });

  it("rejects verbose generated copy that breaks the simple card contract", () => {
    const result = acceptedResult();
    expect(() =>
      validateAnalysisContract(
        {
          ...result,
          signatureRead: {
            ...result.signatureRead,
            title: "Raincoat Lobby Emotional Weather Glow",
          },
        },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");
    expect(() =>
      validateAnalysisContract(
        {
          ...result,
          inscription:
            "The hood frames the face. The eyes stay clear. The room keeps watching.",
        },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");
  });

  it("rejects detached body-part bureaucracy instead of a humanized read", () => {
    const result = acceptedResult();
    expect(() =>
      validateAnalysisContract(
        {
          ...result,
          signatureRead: {
            ...result.signatureRead,
            title: "Teeth Already Voted",
          },
        },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");
  });

  it("rejects main reads and rating phrases that cannot fit the card", () => {
    const result = acceptedResult();
    expect(() =>
      validateAnalysisContract(
        {
          ...result,
          signatureRead: {
            ...result.signatureRead,
            thought: "Miso looks toward the bright window with soft eyes.",
          },
        },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");

    expect(() =>
      validateAnalysisContract(
        {
          ...result,
          ratings: result.ratings.map((rating, index) =>
            index === 0
              ? { ...rating, phrase: "Completely Certain This Belongs Here" }
              : rating,
          ),
        },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");
  });

  it("maps rating evidence onto the seven 70-100 rarity tiers", () => {
    expect(calculateRarityScore([50, 50, 50, 50])).toBe(70);
    expect(calculateRarityScore([78, 78, 78, 78])).toBe(75);
    expect(calculateRarityScore([85, 85, 85, 85])).toBe(80);
    expect(calculateRarityScore([90, 90, 90, 90])).toBe(85);
    expect(calculateRarityScore([94, 94, 94, 94])).toBe(90);
    expect(calculateRarityScore([97, 97, 97, 97])).toBe(95);
    expect(calculateRarityScore([100, 100, 100, 100])).toBe(100);
    expect([70, 74, 75, 79, 80, 84, 85, 89, 90, 94, 95, 99, 100].map(
      getRarityTier,
    )).toEqual([70, 70, 75, 75, 80, 80, 85, 85, 90, 90, 95, 95, 100]);
  });

  it("rejects rarity below 70 or inconsistent with the hidden ratings", () => {
    const result = acceptedResult();
    expect(() =>
      acceptedAnalysisSchema.parse({ ...result, rarityScore: 69 }),
    ).toThrow();
    expect(() =>
      validateAnalysisContract(
        { ...result, rarityScore: 70 },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");
  });

  it("reserves rarity 100 for uniformly exceptional evidence", () => {
    const result = acceptedResult();
    const exceptionalRatings = result.ratings.map((rating, index) => ({
      ...rating,
      score: [98, 99, 100, 100][index],
    }));
    const exceptional = {
      ...result,
      rarityScore: 100,
      signatureRead: { ...result.signatureRead, score: 99 },
      ratings: exceptionalRatings,
    };
    const validated = validateAnalysisContract(
      exceptional,
      "pet",
      "Miso",
      "they",
    );
    expect(validated.status).toBe("accepted");
    if (validated.status !== "accepted") throw new Error("expected acceptance");
    expect(validated.rarityScore).toBe(100);
    expect(() =>
      validateAnalysisContract(
        {
          ...exceptional,
          signatureRead: { ...exceptional.signatureRead, score: 97 },
        },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");
  });

  it("rejects first-person descriptions pretending to be inner voice", () => {
    const result = acceptedResult();
    expect(() =>
      validateAnalysisContract(
        {
          ...result,
          signatureRead: {
            ...result.signatureRead,
            thought:
              "My tongue is out because this warm window clearly belongs to me today.",
          },
        },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");
    expect(() =>
      validateAnalysisContract(
        {
          ...result,
          signatureRead: {
            ...result.signatureRead,
            thought:
              "You finished putting on the coat, so now we are leaving.",
          },
        },
        "pet",
        "Miso",
        "they",
      ),
    ).toThrow("invalid_model_schema");
  });
});

