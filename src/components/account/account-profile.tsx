"use client";

import Link from "next/link";
import { useState } from "react";
import { clearPendingPhoto } from "@/lib/analysis/pending-photo";

export function AccountProfile({ email }: { email: string | null }) {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    localStorage.removeItem("rarely-analysis-id");
    await clearPendingPhoto().catch(() => undefined);
    window.location.href = "/";
  }

  return (
    <section aria-labelledby="profile-heading" className="max-w-[700px]">
      <div className="mb-9">
        <h1 id="profile-heading" className="font-display text-[clamp(2rem,5vw,3rem)] font-normal leading-none">
          Profile
        </h1>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
        <div className="grid gap-2 p-6 sm:grid-cols-[150px_1fr] sm:items-center">
          <span className="text-sm font-extrabold">Email address</span>
          <span className="break-all font-mono text-xs text-ink-muted">{email || "No email available"}</span>
        </div>
        <div className="border-t border-ink/10 p-6">
          <button
            className="min-h-11 rounded-xl border-2 border-ink bg-cream px-5 text-sm font-black text-ink shadow-[3px_3px_0_#241a44] disabled:cursor-wait disabled:opacity-60"
            disabled={signingOut}
            onClick={() => void signOut()}
            type="button"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>

      <section aria-labelledby="help-heading" className="mt-10 border-t border-ink/10 pt-8">
        <h2 id="help-heading" className="text-lg font-black">Help</h2>
        <nav aria-label="Help and policies" className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm font-extrabold text-pink">
          <Link href="/contact">Contact support</Link>
          <Link href="/refund-policy">Refund policy</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </section>
    </section>
  );
}
