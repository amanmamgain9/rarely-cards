"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { RarityMaker } from "@/components/rarity/rarity-maker";
import { RarityMarketing } from "@/components/rarity/rarity-marketing";
import { useHeroDemo } from "@/components/rarity/hero-demo-store";
import { savePendingPhoto } from "@/lib/pending-photo";
import {
  AUTOMATIC_CARD_STYLE,
  readPhoto,
  setPendingPhotoHint,
} from "@/components/rarity/rarity-model";

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
  const [signInMethod, setSignInMethod] = useState<"google" | "email" | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const heroDemo = useHeroDemo();

  async function acceptPhoto(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoMessage("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    setPhotoMessage(null);
    try {
      const preview = await readPhoto(file);
      await savePendingPhoto(file, AUTOMATIC_CARD_STYLE);
      setPendingPhotoHint(true);
      setSelectedFile(file);
      setPhoto(preview);
      setSignInOpen(true);
    } catch (error) {
      setPhotoMessage(
        error instanceof Error
          ? error.message
          : "That photo could not be saved. Choose another one.",
      );
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void acceptPhoto(file);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void acceptPhoto(file);
  }

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
    setMessage(null);
    setSignInMethod("google");
    try {
      const supabase = await getSupabaseClient();
      const nextPath = photo ? "/studio/generate?resume=1" : "/studio";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${nextPath}`,
        },
      });
      if (error) {
        setMessage("Google sign-in could not be started. Try again.");
        setSignInMethod(null);
      }
    } catch {
      setMessage("Google sign-in could not be started. Try again.");
      setSignInMethod(null);
    }
  }

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    if (!email || !supabaseConfigured) return;
    setMessage(null);
    setSignInMethod("email");
    try {
      const supabase = await getSupabaseClient();
      const nextPath = photo ? "/studio/generate?resume=1" : "/studio";
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${nextPath}`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      setMessage("That sign-in link could not be sent. Try again.");
    } finally {
      setSignInMethod(null);
    }
  }

  return (
    <main className="relative overflow-hidden">
      <div className="fixed inset-0 -z-10 bg-soft-pink" aria-hidden="true" />
      <RarityMaker
        signedIn={false}
        creditBalance={0}
        onSignOut={() => undefined}
        dragging={dragging}
        onDraggingChange={setDragging}
        onDrop={handleDrop}
        uploadInput={uploadInput}
        cameraInput={cameraInput}
        onFileChange={handleFile}
        selectedFile={selectedFile}
        flow="idle"
        onSignIn={() => setSignInOpen(true)}
        message={photoMessage}
        photo={photo}
        heroDemoImage={heroDemo.image}
      />
      <RarityMarketing />

      {signInOpen && (
        <section
          className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-ink/85 p-5 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="public-sign-in-title"
          aria-busy={signInMethod !== null}
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
              {photo ? <>PHOTO SAVED.<br /><em className="not-italic text-pink">SIGN IN TO CONTINUE.</em></> : <>SIGN IN.<br /><em className="not-italic text-pink">THEN MAKE THEM TALK.</em></>}
            </h2>
            <p className="mx-auto mb-5 max-w-sm font-extrabold leading-relaxed text-ink-muted">
              {photo
                ? "Your selected photo will be waiting in the app. If you already have a video credit, you’ll go straight to choosing the line."
                : "Sign in to open your video booth and keep your talking-pet videos together."}
            </p>
            <button
              type="button"
              className="mb-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-white px-4 font-black shadow-[3px_3px_0_#241a44] disabled:cursor-wait disabled:bg-workspace disabled:text-ink-muted"
              disabled={signInMethod !== null}
              onClick={() => void signInWithGoogle()}
            >
              {signInMethod === "google" && <span className="size-4 animate-spin rounded-full border-2 border-ink/25 border-t-pink" aria-hidden="true" />}
              {signInMethod === "google" ? "Opening Google…" : "Continue with Google"}
            </button>
            <form className="grid grid-cols-[1fr_auto] gap-2 max-sm:grid-cols-1" onSubmit={sendMagicLink}>
              <input
                className="min-h-12 rounded-xl border-2 border-ink bg-white px-4 outline-none focus:border-purple"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                disabled={signInMethod !== null}
                required
              />
              <button className="rounded-xl border-2 border-ink bg-pink px-4 font-bold text-white disabled:cursor-wait disabled:opacity-60" type="submit" disabled={signInMethod !== null}>
                {signInMethod === "email" ? "Sending link…" : "Email me a sign-in link"}
              </button>
            </form>
            {sent && <strong className="mt-4 block text-sm text-ink-muted">Check your inbox. Your video booth is ready.</strong>}
            {message && <strong className="mt-4 block text-sm text-[#8f1945]" role="alert">{message}</strong>}
          </div>
        </section>
      )}
    </main>
  );
}
