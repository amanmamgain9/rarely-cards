import Link from "next/link";
import { videoExperiences } from "@/lib/experiences";

export function CreationCards({ signedIn = true }: { signedIn?: boolean }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {videoExperiences.map((experience) => (
        <article
          className={`${experience.color} flex min-h-56 flex-col rounded-[24px] border-[3px] border-ink p-6 text-ink shadow-[6px_7px_0_#241a44]`}
          key={experience.kind}
        >
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]">
            {experience.kind === "talking_video"
              ? "1 photo"
              : experience.kind === "birthday_video"
                ? "1–6 photos"
                : "1 photo · any movie"}
          </span>
          <h3 className="mt-5 font-display text-3xl font-normal leading-none">
            {experience.title}
          </h3>
          <p className="mt-3 text-sm font-bold leading-relaxed opacity-75">
            {experience.description}
          </p>
          <Link
            className="mt-auto inline-flex min-h-11 w-fit items-center rounded-xl border-2 border-ink bg-cream px-4 text-xs font-black text-ink shadow-[3px_3px_0_#241a44]"
            href={signedIn ? experience.href : `/?signin=1&next=${encodeURIComponent(experience.href)}`}
          >
            Create →
          </Link>
        </article>
      ))}
    </div>
  );
}
