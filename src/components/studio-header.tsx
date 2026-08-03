"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clearPendingPhoto } from "@/lib/pending-photo";
import { setPendingPhotoHint } from "@/components/rarity/rarity-model";
import { Star } from "@/components/rarity/rarity-icons";

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/client");
  return createClient();
}

export function StudioHeader({ creditBalance }: { creditBalance: number }) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      return;
    }
    setPendingPhotoHint(false);
    await clearPendingPhoto().catch(() => undefined);
    window.location.replace("/");
  }

  const navItem = (href: string, label: string) => {
    const active = href === "/studio" ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-9 items-center border-b-2 px-1 transition-colors ${
          active
            ? "border-pink text-ink"
            : "border-transparent text-ink-muted hover:text-pink"
        }`}
        href={href}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="relative z-20 border-b border-ink/15 bg-cream/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 w-[calc(100%-2.5rem)] max-w-[1120px] items-center justify-between gap-5 max-sm:w-[calc(100%-1.75rem)]">
        <div className="flex items-center gap-8 max-sm:gap-4">
          <Link
            className="inline-flex items-center gap-2 font-display text-xl tracking-tight text-pink"
            href="/studio"
          >
            RARELY
            <span className="grid size-5 place-items-center rounded-full border-2 border-ink bg-yellow text-pink [&>svg]:w-2.5">
              <Star />
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-xs font-black" aria-label="App navigation">
            {navItem("/studio", "Videos")}
            {navItem("/studio/generate", "Create")}
          </nav>
        </div>
        <nav className="flex items-center gap-4 text-xs font-black" aria-label="Account navigation">
          <Link className="rounded-full border border-ink/20 bg-white px-3 py-2 font-mono text-[9px] font-medium hover:border-pink hover:text-pink max-sm:px-2" href="/studio/credits">
            {creditBalance} {creditBalance === 1 ? "credit" : "credits"}
          </Link>
          <Link className="text-ink-muted hover:text-pink max-sm:hidden" href="/account">
            Account
          </Link>
          <button
            className="min-h-9 border-0 bg-transparent p-0 text-ink-muted hover:text-pink disabled:opacity-50"
            type="button"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            {signingOut ? "Leaving…" : "Sign out"}
          </button>
        </nav>
      </div>
    </header>
  );
}
