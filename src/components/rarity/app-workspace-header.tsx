import Link from "next/link";
import { Star } from "@/components/rarity/rarity-icons";

export function AppWorkspaceHeader({
  creditBalance,
  onSignOut,
}: {
  creditBalance: number;
  onSignOut: () => void;
}) {
  return (
    <header className="relative z-10 flex min-h-16 items-center justify-between gap-6 border-b border-ink/15 bg-cream/90 px-[max(1.5rem,calc((100vw-1120px)/2))] backdrop-blur-xl max-[700px]:px-4">
      <Link className="inline-flex items-center gap-2 font-display text-xl tracking-tight text-pink" href="/app">
        RARELY <span className="grid size-5 place-items-center rounded-full border-2 border-ink bg-yellow text-pink [&>svg]:w-2.5"><Star /></span>
      </Link>
      <nav className="flex items-center gap-5 text-xs font-black max-[700px]:gap-3" aria-label="Account navigation">
        <span className="rounded-full border border-ink/20 bg-white px-3 py-2 font-mono text-[10px] font-medium max-[700px]:px-2 max-[700px]:text-[9px]">
          {creditBalance} video {creditBalance === 1 ? "credit" : "credits"}
        </span>
        <Link className="inline-flex min-h-9 items-center text-ink-muted hover:text-pink max-[700px]:hidden" href="/account">Account</Link>
        <button className="inline-flex min-h-9 items-center border-0 bg-transparent p-0 text-ink-muted hover:text-pink" type="button" onClick={onSignOut}>Sign out</button>
      </nav>
    </header>
  );
}

export function AppStepRail({ active }: { active: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="my-8 grid list-none grid-cols-4 p-0" aria-label="Video creation progress">
      {["Credits", "Photo", "Line", "Video"].map((label, index) => (
        <li
          key={label}
          className={`relative flex items-center gap-2 font-mono text-[10px] font-medium max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-1 max-[700px]:text-[8px] ${index <= active ? "text-ink" : "text-[#958ba5]"}`}
          aria-current={index === active ? "step" : undefined}
        >
          <span className={`relative z-10 grid size-8 place-items-center rounded-full border bg-workspace ${index < active ? "border-pink bg-pink text-white" : index === active ? "border-2 border-ink bg-yellow shadow-[2px_2px_0_#241a44]" : "border-[#cfc7d7]"}`}>{index < active ? "✓" : index + 1}</span>
          <b>{label}</b>
        </li>
      ))}
    </ol>
  );
}
