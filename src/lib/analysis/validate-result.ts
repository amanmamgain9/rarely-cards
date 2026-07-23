import type {
  AnalysisResult,
  CardStyle,
  PetPronouns,
} from "@/lib/analysis/types";
import { PET_RATING_PARAMETERS } from "@/lib/rarity/pet-config";
import { calculateRarityScore } from "@/lib/rarity/score";

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function sentenceCount(value: string) {
  return value
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}

const detachedComedyPattern =
  /\b(votes?|voted|voting|briefings?|protocols?|committees?|audits?|audited|auditing|polic(?:y|ies)|negotiations?|custody|verdicts?|incidents?|assignments?|proceedings?|ceo|managers?|supervisors?|professional)\b/i;
const firstPersonAppearancePattern =
  /\bmy\s+(tongue|eyes?|ears?|teeth|tooth|fur|coat|markings?|face|muzzle|paws?|tail|hood|body|pose|underbite)\b/i;
const inventedOwnerActionPattern =
  /\byou\s+(finished|put|placed|dressed|gave|brought|opened|closed|picked|carried|took)\b/i;
const firstPersonRatingPattern =
  /\b(i|i'm|i've|i'll|me|my|mine|we|we're|we've|us|our|ours)\b/i;

function containsWrongPronouns(value: string, pronouns: PetPronouns) {
  const wrongPronouns: Record<PetPronouns, RegExp> = {
    he: /\b(she|her|hers|they|them|their|theirs)\b/i,
    she: /\b(he|him|his|they|them|their|theirs)\b/i,
    they: /\b(he|him|his|she|her|hers)\b/i,
  };
  return wrongPronouns[pronouns].test(value);
}

export function validateAnalysisContract(
  result: AnalysisResult,
  style: CardStyle,
  petName?: string,
  pronouns?: PetPronouns,
) {
  if (result.status === "rejected") return result;

  if (style !== "pet" || !petName || !pronouns) {
    throw new Error("invalid_model_schema");
  }

  const expectedKeys = PET_RATING_PARAMETERS.map((parameter) => parameter.key);
  const returnedKeys = result.ratings.map((rating) => rating.key);

  if (
    returnedKeys.length !== expectedKeys.length ||
    returnedKeys.some((key, index) => key !== expectedKeys[index]) ||
    result.ratings.some(
      (rating, index) => rating.label !== PET_RATING_PARAMETERS[index].name,
    ) ||
    result.petName !== petName ||
    result.pronouns !== pronouns ||
    !result.species ||
    !result.energy ||
    !result.fieldNote ||
    !result.inscription
  ) {
    throw new Error("invalid_model_schema");
  }

  const generatedCopy = [
    result.cardTitle,
    result.signatureRead.title,
    result.signatureRead.thought,
    result.fieldNote,
    result.inscription,
    ...result.ratings.flatMap((rating) => [rating.phrase, rating.reason]),
  ].join(" ");

  if (
    wordCount(result.cardTitle) < 2 ||
    wordCount(result.cardTitle) > 4 ||
    wordCount(result.signatureRead.title) < 2 ||
    wordCount(result.signatureRead.title) > 4 ||
    wordCount(result.signatureRead.thought) < 10 ||
    wordCount(result.signatureRead.thought) > 18 ||
    sentenceCount(result.signatureRead.thought) !== 1 ||
    result.ratings.some(
      (rating) =>
        wordCount(rating.phrase) < 2 ||
        wordCount(rating.phrase) > 4 ||
        firstPersonRatingPattern.test(rating.phrase),
    ) ||
    wordCount(result.fieldNote) < 6 ||
    wordCount(result.fieldNote) > 14 ||
    sentenceCount(result.fieldNote) !== 1 ||
    wordCount(result.inscription) > 34 ||
    sentenceCount(result.inscription) !== 2 ||
    /\b(always|usually|every time)\b/i.test(generatedCopy) ||
    detachedComedyPattern.test(generatedCopy) ||
    firstPersonAppearancePattern.test(
      `${result.signatureRead.thought} ${result.fieldNote}`,
    ) ||
    inventedOwnerActionPattern.test(
      `${result.signatureRead.thought} ${result.fieldNote}`,
    ) ||
    containsWrongPronouns(generatedCopy, pronouns)
  ) {
    throw new Error("invalid_model_schema");
  }

  const allScores = result.ratings.map((rating) => rating.score);
  const expectedRarity = calculateRarityScore(allScores);
  const scoreSpread = Math.max(...allScores) - Math.min(...allScores);
  if (
    (result.rarityScore === 100 ? scoreSpread < 2 : scoreSpread < 8) ||
    Math.abs(result.rarityScore - expectedRarity) > 1 ||
    (result.rarityScore === 100 &&
      (Math.min(...allScores) < 98 || result.signatureRead.score < 98))
  ) {
    throw new Error("invalid_model_schema");
  }

  return result;
}

