import Link from "next/link";

export function CreationCards({ signedIn = true }: { signedIn?: boolean }) {
  const href = signedIn ? "/studio/create" : `/?signin=1&next=${encodeURIComponent("/studio/create")}`;
  return (
    <article className="mx-auto flex min-h-56 max-w-xl flex-col rounded-[24px] border-[3px] border-ink bg-yellow p-6 text-ink shadow-[6px_7px_0_#241a44]">
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]">1 picture · 1 request</span>
      <h3 className="mt-5 font-display text-3xl font-normal leading-none">Make anything</h3>
      <p className="mt-3 text-sm font-bold leading-relaxed opacity-75">Choose a picture and tell Rarely what you want.</p>
      <Link className="mt-auto inline-flex min-h-11 w-fit items-center rounded-xl border-2 border-ink bg-cream px-4 text-xs font-black text-ink shadow-[3px_3px_0_#241a44]" href={href}>
        Start →
      </Link>
    </article>
  );
}
