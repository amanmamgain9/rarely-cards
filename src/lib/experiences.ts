import type { ExperienceKind } from "@/lib/analysis/types";

export const videoExperiences = [
  {
    kind: "talking_video",
    title: "Talking pet",
    description: "One photo, one line, one talking-pet video.",
    href: "/studio/talking-pet",
    color: "bg-yellow",
  },
  {
    kind: "birthday_video",
    title: "Birthday video",
    description: "Bring 1–6 pets together for a birthday greeting.",
    href: "/studio/birthday",
    color: "bg-purple",
  },
  {
    kind: "movie_scene",
    title: "Movie moment",
    description: "Put your pet inside a famous movie scene.",
    href: "/studio/movie",
    color: "bg-pink text-white",
  },
] as const;

export function studioPath(
  kind: Exclude<ExperienceKind, "card">,
  draftId?: string,
) {
  const href = videoExperiences.find((experience) => experience.kind === kind)?.href;
  if (!href) return "/studio/create";
  return draftId ? `${href}?draft=${encodeURIComponent(draftId)}` : href;
}
