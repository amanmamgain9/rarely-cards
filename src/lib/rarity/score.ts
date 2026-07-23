export const MINIMUM_RARITY_SCORE = 70;

export type RarityTier = 70 | 75 | 80 | 85 | 90 | 95 | 100;

export function calculateRarityScore(scores: readonly number[]) {
  if (scores.length === 0) return MINIMUM_RARITY_SCORE;
  const average =
    scores.reduce((total, score) => total + score, 0) / scores.length;
  const normalized = Math.min(1, Math.max(0, (average - 50) / 50));
  return Math.round(
    MINIMUM_RARITY_SCORE + 30 * normalized ** 3,
  );
}

export function getRarityTier(score: number): RarityTier {
  if (score >= 100) return 100;
  if (score >= 95) return 95;
  if (score >= 90) return 90;
  if (score >= 85) return 85;
  if (score >= 80) return 80;
  if (score >= 75) return 75;
  return 70;
}
