import type {
  ChangeEventHandler,
  DragEventHandler,
  RefObject,
} from "react";
import { ShareCard } from "@/components/share-card";
import { Camera, Star, Upload } from "@/components/rarity/rarity-icons";
import type { FlowState } from "@/components/rarity/rarity-model";
import type { AcceptedAnalysis } from "@/lib/analysis/types";

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
  onOpenCheckout: () => void;
  checkoutPrice: string | null;
  message: string | null;
  photo: string | null;
  result: AcceptedAnalysis | null;
  heroDemoImage: string;
  heroCardPhoto: string;
  heroCardResult: AcceptedAnalysis;
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
  onOpenCheckout,
  checkoutPrice,
  message,
  photo,
  result,
  heroDemoImage,
  heroCardPhoto,
  heroCardResult,
}: RarityMakerProps) {
  return (
    <>
      <header className="nav">
        <a className="brand" href="#">RARELY <span><Star /></span></a>
        <div className="nav-center">
          <a href="#example">See an example</a>
          <a href="/pricing">Pricing</a>
          <a href="#stats">Why you&apos;ll keep it</a>
          <a href="#how">How it works</a>
        </div>
        {signedIn ? (
          <div className="nav-account">
            <a href="/account"><i /> {creditBalance} credits · Account</a>
            <button type="button" onClick={onSignOut}>Sign out</button>
          </div>
        ) : (
          <a className="nav-button" href="#maker">
            Make a card <span>→</span>
          </a>
        )}
      </header>

      <section className="hero" id="maker">
        <div className="hero-burst burst-one" aria-hidden="true"><Star /></div>
        <div className="hero-content">
          <div className="mini-tag"><span>AI PET CARDS</span> CAT OR DOG · 5 CARD CREDITS · $5</div>
          <h1>PET PHOTO<span>→ STORY CARD.</span></h1>
          <p className="hero-copy">
            Upload the photo that feels most like them. We turn that one look into
            a one-of-one card with the voice you already hear in your head—funny,
            specific, and unmistakably theirs.
          </p>
          <div className="upload-instruction">
            <span>01</span>
            <div>
              <small>SHOW US THEIR WORLD</small>
              <strong>ADD THEIR PHOTO</strong>
              <p>Close-up or full scene. One clear cat or dog. Let the room tell on them.</p>
            </div>
            <i aria-hidden="true">↓</i>
          </div>
          <div
            className={`photo-actions ${dragging ? "is-dragging" : ""}`}
            onDragOver={(event) => { event.preventDefault(); onDraggingChange(true); }}
            onDragLeave={() => onDraggingChange(false)}
            onDrop={onDrop}
          >
            <input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} hidden />
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={onFileChange} hidden />
            <button className="action-button selfie-button" type="button" onClick={() => cameraInput.current?.click()}>
              <span className="action-icon"><Camera /></span>
              <span><b>TAKE THEIR PHOTO</b><small>Open your camera</small></span>
            </button>
            <span className="action-or">OR</span>
            <button className="action-button upload-button" type="button" onClick={() => uploadInput.current?.click()}>
              <span className="action-icon"><Upload /></span>
              <span><b>{selectedFile ? "CHOOSE A DIFFERENT PHOTO" : "UPLOAD THEIR PHOTO"}</b><small>Pick from your camera roll</small></span>
            </button>
          </div>
          <p className="upload-consent">
            By adding a photo, you confirm you may use it and consent to private AI
            processing under our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
          </p>
          <button
            className="reveal-cta"
            type="button"
            disabled={flow !== "checkout"}
            onClick={onOpenCheckout}
          >
            <span>
              {flow === "checkout"
                ? `Get 5 card credits${checkoutPrice ? ` — ${checkoutPrice}` : ""}`
                : selectedFile
                  ? signedIn
                    ? "Preparing secure checkout"
                    : "Sign in to continue"
                  : "Start with a pet photo ↑"}
            </span>
            <span className="cta-ball" aria-hidden="true"><i /></span>
          </button>
          <p className="privacy">
            <span>◆</span> Private upload · Saved securely with completed cards · 5 attempts for $5
          </p>
          {message && flow !== "retry" && <p className="photo-error" role="alert">{message}</p>}
        </div>

        <div className="card-zone">
          <div className="card-label label-top">
            {photo ? "YOUR PHOTO" : "REAL CARD PREVIEW"} <span>★</span>
          </div>
          <div className="card-label label-side">DOWNLOADABLE · 9:16</div>
          <div className="hero-story-card" key={photo || result ? "active-card" : heroDemoImage}>
            <ShareCard
              photo={heroCardPhoto}
              result={heroCardResult}
              pending={Boolean(photo && !result)}
              photoPriority
            />
          </div>
          <div className="card-shadow-pink" aria-hidden="true" />
        </div>
      </section>
    </>
  );
}
