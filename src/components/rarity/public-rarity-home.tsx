"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { RarityMaker } from "@/components/rarity/rarity-maker";
import { RarityMarketing } from "@/components/rarity/rarity-marketing";
import { useHeroDemo } from "@/components/rarity/hero-demo-store";

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/client");
  return createClient();
}

export function PublicRarityHome({
  supabaseConfigured,
  openSignIn,
  authError,
}: {
  supabaseConfigured: boolean;
  openSignIn: boolean;
  authError: string | null;
}) {
  const [signInOpen, setSignInOpen] = useState(openSignIn || Boolean(authError));
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState(authError);
  const uploadInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const heroDemo = useHeroDemo();

  useEffect(() => {
    if (!signInOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSignInOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [signInOpen]);

  async function signInWithGoogle() {
    if (!supabaseConfigured) {
      setMessage("Sign-in is temporarily unavailable.");
      return;
    }
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/app`,
      },
    });
    if (error) setMessage("Google sign-in could not be started. Try again.");
  }

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    if (!email || !supabaseConfigured) return;
    setMessage(null);
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/app`,
      },
    });
    if (error) {
      setMessage("That sign-in link could not be sent. Try again.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="relative overflow-hidden">
      <div className="fixed inset-0 -z-10 bg-soft-pink" aria-hidden="true" />
      <RarityMaker
        signedIn={false}
        creditBalance={0}
        onSignOut={() => undefined}
        dragging={false}
        onDraggingChange={() => undefined}
        onDrop={(event) => event.preventDefault()}
        uploadInput={uploadInput}
        cameraInput={cameraInput}
        onFileChange={() => undefined}
        selectedFile={null}
        flow="idle"
        onOpenCheckout={() => setSignInOpen(true)}
        onGetStarted={() => setSignInOpen(true)}
        checkoutPrice="$10"
        message={null}
        photo={null}
        heroDemoImage={heroDemo.image}
      />
      <RarityMarketing />

      {signInOpen && (
        <section
          className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-ink/85 p-5 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="public-sign-in-title"
        >
          <div className="relative w-full max-w-lg rounded-3xl border-4 border-ink bg-cream p-9 text-center text-ink shadow-[10px_11px_0_#f4458f,17px_18px_0_#ffe36e]">
            <button
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border-2 border-ink bg-white [&_svg]:w-4 [&_svg]:stroke-ink [&_svg]:stroke-2"
              type="button"
              onClick={() => setSignInOpen(false)}
              aria-label="Close sign-in"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            <span className="inline-flex rounded-md border-2 border-ink bg-yellow px-3 py-1 font-mono text-[9px] font-bold shadow-[3px_3px_0_#241a44]">YOUR VIDEO BOOTH</span>
            <h2 className="my-5 font-display text-[clamp(2.375rem,8vw,3.625rem)] font-normal leading-none" id="public-sign-in-title">
              SIGN IN.<br /><em className="not-italic text-pink">THEN MAKE THEM TALK.</em>
            </h2>
            <p className="mx-auto mb-5 max-w-sm font-extrabold leading-relaxed text-ink-muted">
              Create your account, get three video credits, then choose the
              photo and the perfect line.
            </p>
            <button
              type="button"
              className="mb-3 min-h-12 w-full rounded-xl border-2 border-ink bg-white px-4 font-black shadow-[3px_3px_0_#241a44]"
              onClick={() => void signInWithGoogle()}
            >
              Continue with Google
            </button>
            <form className="grid grid-cols-[1fr_auto] gap-2 max-sm:grid-cols-1" onSubmit={sendMagicLink}>
              <input
                className="min-h-12 rounded-xl border-2 border-ink bg-white px-4 outline-none focus:border-purple"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                required
              />
              <button className="rounded-xl border-2 border-ink bg-pink px-4 font-bold text-white" type="submit">Email me a sign-in link</button>
            </form>
            {sent && <strong className="mt-4 block text-sm text-ink-muted">Check your inbox. Your video booth is ready.</strong>}
            {message && <strong className="mt-4 block text-sm text-[#8f1945]" role="alert">{message}</strong>}
          </div>
        </section>
      )}
    </main>
  );
}
