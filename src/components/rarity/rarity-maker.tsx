import type {
  ChangeEventHandler,
  DragEventHandler,
  RefObject,
} from "react";
import { Camera, Star, Upload } from "@/components/rarity/rarity-icons";
import type { FlowState } from "@/components/rarity/rarity-model";

type RarityMakerProps = {
  signedIn: boolean;
  creditBalance: number;
  onSignOut: () => void;
  dragging: boolean;
  onDraggingChange: (dragging: boolean) => void;
  onDrop: DragEventHandler<HTMLDivElement>;
  uploadInput: RefObject<HTMLInputElement | null>;
  cameraInput: RefObject<HTMLInputElement | null>;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
  selectedFile: File | null;
  flow: FlowState;
  onSignIn: () => void;
  message: string | null;
  photo: string | null;
  heroDemoImage: string;
};

export function RarityMaker({
  signedIn,
  creditBalance,
  onSignOut,
  dragging,
  onDraggingChange,
  onDrop,
  uploadInput,
  cameraInput,
  onFileChange,
  selectedFile,
  flow,
  onSignIn,
  message,
  photo,
  heroDemoImage,
}: RarityMakerProps) {
  const creditedWorkspace = signedIn && creditBalance > 0;

  return (
    <>
      <header className="relative z-20 mx-auto flex min-h-20 w-[calc(100%-2.5rem)] max-w-[1420px] items-center justify-between gap-6 border-b-[3px] border-ink px-2 max-md:w-[calc(100%-1.5rem)]">
        <a className="inline-flex items-center gap-2 font-display text-2xl text-pink" href="#">RARELY <span className="grid size-7 place-items-center rounded-full border-2 border-ink bg-yellow [&>svg]:w-4"><Star /></span></a>
        {!creditedWorkspace && (
          <div className="flex items-center gap-6 font-mono text-[10px] font-medium uppercase text-ink-muted max-lg:hidden">
            <a href="#example">See an example</a>
            <a href="/pricing">Pricing</a>
            <a href="#stats">Why you&apos;ll keep it</a>
            <a href="#how">How it works</a>
          </div>
        )}
        {signedIn ? (
          <div className="flex items-center gap-4 font-mono text-[10px] font-bold uppercase">
            <a className="inline-flex items-center gap-2" href="/account"><i className="size-2 rounded-full border border-ink bg-[#66d68d]" /> {creditBalance} credits · Account</a>
            <button className="border-0 bg-transparent text-pink" type="button" onClick={onSignOut}>Sign out</button>
          </div>
        ) : (
          <button className="rounded-xl border-2 border-ink bg-yellow px-4 py-3 font-mono text-[10px] font-bold shadow-[3px_3px_0_#241a44]" type="button" onClick={onSignIn}>
            Sign in <span aria-hidden="true">→</span>
          </button>
        )}
      </header>

      <section className={`relative mx-auto grid min-h-[calc(100svh-5rem)] w-[calc(100%-2.5rem)] max-w-[1320px] items-center gap-16 overflow-hidden py-16 lg:grid-cols-[1.05fr_0.95fr] max-md:w-[calc(100%-1.5rem)] max-md:gap-10 max-md:py-10 ${creditedWorkspace ? "bg-workspace" : ""}`} id="maker">
        {!creditedWorkspace && (
          <div className="absolute left-1/2 top-8 -z-10 w-20 rotate-12 text-yellow opacity-70" aria-hidden="true"><Star /></div>
        )}
        <div className="relative z-10 max-w-2xl">
          <div className="mb-5 flex w-fit items-center gap-3 rounded-full border-2 border-ink bg-cream px-3 py-2 font-mono text-[9px] font-bold uppercase shadow-[3px_3px_0_#241a44]">
            <span className="rounded-full bg-pink px-2 py-1 text-white">{creditedWorkspace ? "VIDEOS READY" : "AI TALKING PETS"}</span>
            {creditedWorkspace
              ? `${creditBalance} VIDEO${creditBalance === 1 ? "" : "S"} READY · 1 CREDIT EACH`
              : "PHOTO FIRST · NO PAYMENT YET"}
          </div>
          <h1 className="font-display text-[2.5rem] font-normal leading-[0.88] tracking-[-0.055em] sm:text-[3.6rem] lg:text-[6.5rem]">
            {creditedWorkspace ? "PICK A PHOTO." : "GIVE THAT LOOK"}
            <span className="mt-2 block text-pink [text-shadow:5px_5px_0_#ffe36e]">{creditedWorkspace ? "MAKE THEM TALK." : "A VOICE."}</span>
          </h1>
          <p className="my-6 max-w-xl text-base font-bold leading-relaxed text-ink-muted sm:text-lg">
            {creditedWorkspace
              ? "Choose one clear photo. Pick one line inspired by that look—or write your own—and get an eight-second talking-pet reel."
              : "Choose a photo, pick their line, and watch them say it in a tiny video made for sharing."}
          </p>
          <p className="mb-5 font-mono text-[10px] font-bold uppercase text-pink">
            01 Photo <b>→</b> 02 Pick a line <b>→</b> 03 Video
          </p>
          <div
            className={`grid items-center gap-3 rounded-2xl border-2 border-dashed p-3 sm:grid-cols-[1fr_auto_1fr] ${dragging ? "border-pink bg-pink/10" : "border-ink/30"}`}
            onDragOver={(event) => {
              event.preventDefault();
              onDraggingChange(true);
            }}
            onDragLeave={() => onDraggingChange(false)}
            onDrop={onDrop}
          >
            <input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} hidden />
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={onFileChange} hidden />
            <button
              className="flex min-h-20 items-center gap-3 rounded-xl border-2 border-ink bg-pink p-3 text-left text-white shadow-[3px_3px_0_#241a44]"
              type="button"
              onClick={() => cameraInput.current?.click()}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border-2 border-ink bg-yellow text-ink [&>svg]:w-5"><Camera /></span>
              <span>
                <b>TAKE THEIR PHOTO</b>
                <small className="block text-[10px] opacity-80">Open your camera</small>
              </span>
            </button>
            <span className="font-mono text-[9px] font-bold text-ink-muted">OR</span>
            <button
              className="flex min-h-20 items-center gap-3 rounded-xl border-2 border-ink bg-cream p-3 text-left text-ink shadow-[3px_3px_0_#241a44]"
              type="button"
              onClick={() => uploadInput.current?.click()}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border-2 border-ink bg-purple text-ink [&>svg]:w-5"><Upload /></span>
              <span>
                <b>{selectedFile ? "CHOOSE A DIFFERENT PHOTO" : "UPLOAD THEIR PHOTO"}</b>
                <small className="block text-[10px] text-ink-muted">Pick from your camera roll</small>
              </span>
            </button>
          </div>
          <p className="mt-3 text-[10px] font-bold leading-relaxed text-ink-muted [&_a]:underline">
            By adding a photo, you confirm you may use it and consent to private AI
            processing under our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
          </p>
          <p className="mt-4 font-mono text-[9px] text-ink-muted">
            <span>◆</span>{" "}
            {creditedWorkspace
              ? "Private upload · Failed generations return the video credit"
              : "Choose a photo now · Sign in next · Pay only if you need credits"}
          </p>
          {message && flow !== "retry" && <p className="mt-4 rounded-lg border border-[#d73b75] bg-[#fff0f5] px-4 py-3 text-[13px] font-extrabold text-[#8f1945]" role="alert">{message}</p>}
        </div>

        <div className="relative mx-auto w-full max-w-[430px]">
          <div className="absolute -top-5 left-4 z-10 rotate-[-2deg] rounded-md border-2 border-ink bg-yellow px-3 py-2 font-mono text-[8px] font-bold">
            {photo
              ? "YOUR PET"
              : creditedWorkspace
                ? "YOUR VIDEO STARTS HERE"
                : "THE PHOTO BECOMES THE REEL"}{" "}<span>★</span>
          </div>
          <div className="absolute -right-12 top-1/2 z-10 rotate-90 rounded-md border-2 border-ink bg-cream px-3 py-2 font-mono text-[8px] font-bold max-sm:hidden">
            {creditedWorkspace ? "PHOTO → LINE → TALKING VIDEO" : "8 SEC · 9:16 · SOUND"}
          </div>
          <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] border-4 border-ink bg-purple shadow-[10px_11px_0_#241a44,18px_19px_0_#f4458f]" key={photo || heroDemoImage}>
            {/* Blob previews and signed account URLs are intentionally rendered directly. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="size-full object-cover" src={photo || heroDemoImage} alt={photo ? "Your selected pet" : "A pet ready to become a talking video"} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/90" aria-hidden="true" />
            <span className="absolute left-4 top-4 rounded-full bg-ink/70 px-3 py-1 font-mono text-[8px] text-white">RARELY · ORIGINAL AUDIO</span>
            <button type="button" tabIndex={-1} aria-hidden="true" className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-ink bg-yellow shadow-[4px_4px_0_#f4458f]">
              <i className="ml-1 size-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-ink" />
            </button>
            <blockquote className="absolute bottom-16 left-5 right-5 m-0 text-center font-display text-xl leading-tight text-white">
              {photo ? "Reading that face…" : "I heard the treat bag. Continue."}
            </blockquote>
            <div className="absolute bottom-6 left-6 right-6 flex h-5 items-center justify-center gap-1" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => <i className="w-1 rounded-full bg-yellow" style={{ height: `${6 + ((index * 7) % 15)}px` }} key={index} />)}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
