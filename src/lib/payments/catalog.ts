export type CreditKind = "card" | "talking_video";

export function googlePlayCreditKind(
  productId: string,
  videoProductId: string,
  legacyCardProductIds: readonly string[],
): CreditKind | null {
  if (productId === videoProductId) return "talking_video";
  if (legacyCardProductIds.includes(productId)) return "card";
  return null;
}

export function analysisCreditKind(
  experienceKind: "card" | "talking_video" | "birthday_video" | "movie_scene",
): CreditKind {
  return experienceKind === "card" ? "card" : "talking_video";
}
