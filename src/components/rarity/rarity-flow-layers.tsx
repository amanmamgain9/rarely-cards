import type {
  FormEventHandler,
  RefObject,
} from "react";
import { ShareCard } from "@/components/share-card";
import { Printer, Upload } from "@/components/rarity/rarity-icons";
import type { FlowState } from "@/components/rarity/rarity-model";
import type { AcceptedAnalysis, PetPronouns } from "@/lib/analysis/types";
import type { PaymentChannel } from "@/lib/payments/use-payment-channel";

type RarityFlowLayersProps = {
  flow: FlowState;
  photo: string | null;
  petName: string;
  busyLabel: string;
  busyCopy: string;
  progressStage: number;
  onSignInWithGoogle: () => void;
  onSendMagicLink: FormEventHandler<HTMLFormElement>;
  email: string;
  onEmailChange: (email: string) => void;
  authSent: boolean;
  onDismissAuth: () => void;
  checkoutPromptOpen: boolean;
  checkoutPrice: string | null;
  checkoutBusy: boolean;
  analysisId: string | null;
  checkoutAvailable: boolean;
  onStartCheckout: () => void;
  paymentChannel: PaymentChannel;
  googlePlayConfigured: boolean;
  uploadInput: RefObject<HTMLInputElement | null>;
  onCloseCheckout: () => void;
  message: string | null;
  creditBalance: number;
  onSubmitPetName: FormEventHandler<HTMLFormElement>;
  petNameInput: RefObject<HTMLInputElement | null>;
  onPetNameChange: (petName: string) => void;
  petPronouns: PetPronouns;
  onPetPronounsChange: (pronouns: PetPronouns) => void;
};

export function RarityFlowLayers({
  flow,
  photo,
  petName,
  busyLabel,
  busyCopy,
  progressStage,
  onSignInWithGoogle,
  onSendMagicLink,
  email,
  onEmailChange,
  authSent,
  onDismissAuth,
  checkoutPromptOpen,
  checkoutPrice,
  checkoutBusy,
  analysisId,
  checkoutAvailable,
  onStartCheckout,
  paymentChannel,
  googlePlayConfigured,
  uploadInput,
  onCloseCheckout,
  message,
  creditBalance,
  onSubmitPetName,
  petNameInput,
  onPetNameChange,
  petPronouns,
  onPetPronounsChange,
}: RarityFlowLayersProps) {
  return (
    <>
      {flow === "restoring" && (
        <section className="flow-overlay" aria-live="polite">
          <div className="flow-dialog">
            <span className="pixel-label">YOUR PHOTO IS SAFE</span>
            <h2>PICKING UP<br /><em>WHERE YOU LEFT OFF.</em></h2>
            <p>Restoring their photo and the next step of their card.</p>
          </div>
        </section>
      )}

      {["verifying", "processing"].includes(flow) && photo && (
        <section className="analysis-overlay" aria-live="polite">
          <div className="analysis-noise" />
          <div className="analysis-shell">
            <div className="analysis-topline">
              <span>RLY / CARD CHECKOUT</span>
              <span>
                {flow === "processing"
                  ? "1 CREDIT RESERVED · MAKING THEIRS"
                  : "PAYMENT COMPLETE · ADDING 5 CREDITS"}
              </span>
            </div>
            <div className="scan-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" />
              <div className="scan-grid" />
              <div className="scan-line" />
            </div>
            <div className="analysis-copy">
              <span className="analysis-kicker">
                {flow === "processing" ? "THEIR CARD IS UNDERWAY" : "PAYMENT RECEIVED"}
              </span>
              <h2>{busyLabel}<i>...</i></h2>
              <p>{busyCopy}</p>
              <div className="analysis-progress">
                {["Confirm credit", "Make their card"].map((step, index) => (
                  <div
                    className={
                      index < progressStage
                        ? "complete"
                        : index === progressStage
                          ? "current"
                          : ""
                    }
                    key={step}
                  >
                    <span>0{index + 1}</span><b>{step}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {flow === "auth" && photo && (
        <section className="flow-overlay" aria-label="Sign in to continue">
          <div className="flow-dialog photo-flow-dialog">
            <figure className="photo-flow-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={`The photo you chose of ${petName || "your pet"}`} />
              <figcaption>THE PHOTO YOU CHOSE <span>★</span></figcaption>
            </figure>
            <div className="photo-flow-copy">
              <span className="pixel-label">SIGN IN · THEN USE A CREDIT</span>
              <h2>KEEP THIS LOOK.<br /><em>FINISH THE CARD.</em></h2>
              <p>
                Google briefly takes you away and brings you right back to this
                photo. If you already have a card credit, we continue. If not,
                one $5 pack adds five.
              </p>
              <button type="button" className="google-button" onClick={onSignInWithGoogle}>
                Continue with Google
              </button>
              <form onSubmit={onSendMagicLink}>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address"
                  required
                />
                <button type="submit">Send my sign-in link</button>
              </form>
              {authSent && <strong>Check your inbox. Their photo is staying right here.</strong>}
              <button className="text-button" type="button" onClick={onDismissAuth}>
                Not yet
              </button>
            </div>
          </div>
        </section>
      )}

      {flow === "checkout" && checkoutPromptOpen && photo && (
        <section className="flow-overlay" aria-label="Make your pet's card">
          <div className="flow-dialog photo-flow-dialog">
            <figure className="photo-flow-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={`The photo you chose of ${petName || "your pet"}`} />
              <figcaption>THIS IS THE ONE <span>★</span></figcaption>
            </figure>
            <div className="photo-flow-copy checkout-flow-copy">
              <span className="pixel-label">
                PHOTO READY · FIVE CREDITS
                {checkoutPrice ? ` FOR ${checkoutPrice.toUpperCase()}` : ""}
              </span>
              <h2>THEY GAVE YOU<br /><em>THIS MOMENT.</em></h2>
              <p>
                Five chances to turn the looks only you understand into cards
                you&apos;ll want to keep and share.
              </p>
              <button
                type="button"
                className="checkout-button"
                disabled={checkoutBusy || !analysisId || !checkoutAvailable}
                onClick={onStartCheckout}
              >
                {checkoutBusy
                  ? "Opening checkout…"
                  : !analysisId || paymentChannel === "loading"
                    ? "Preparing secure checkout…"
                    : paymentChannel === "play_unavailable"
                      ? "Google Play Billing unavailable"
                      : paymentChannel === "google_play" && !googlePlayConfigured
                        ? "Google Play checkout temporarily unavailable"
                        : `Pay${checkoutPrice ? ` ${checkoutPrice}` : ""} · Get 5 card credits`}
              </button>
              {paymentChannel === "play_unavailable" && (
                <small>
                  Update Chrome or reopen Rarely from Google Play. Web checkout
                  is disabled inside the Android app.
                </small>
              )}
              <small>One-time payment · No subscription · Buy another pack anytime</small>
              <button type="button" className="text-button" onClick={() => uploadInput.current?.click()}>
                Choose a different photo
              </button>
              <button type="button" className="text-button" onClick={onCloseCheckout}>
                Not now
              </button>
              {message && <strong role="alert">{message}</strong>}
            </div>
          </div>
        </section>
      )}

      {flow === "naming" && (
        <section className="flow-overlay" aria-label="Name your pet">
          <div className="flow-dialog naming-dialog">
            <span className="pixel-label">
              {creditBalance} CREDIT{creditBalance === 1 ? "" : "S"} READY · ONE LAST THING
            </span>
            <h2>WHAT DO THEY<br /><em>ANSWER TO?</em></h2>
            <p>
              Give us the name that belongs at the top of the card. Then we read
              the photograph.
            </p>
            <form className="naming-form" onSubmit={onSubmitPetName}>
              <input
                ref={petNameInput}
                type="text"
                value={petName}
                onChange={(event) => onPetNameChange(event.target.value)}
                placeholder="Their name"
                maxLength={30}
                autoComplete="off"
                autoFocus
                required
              />
              <fieldset className="pronoun-picker">
                <legend>How should the card refer to them?</legend>
                {[
                  ["he", "He / him"],
                  ["she", "She / her"],
                  ["they", "They / them"],
                ].map(([value, label]) => (
                  <label className={petPronouns === value ? "selected" : ""} key={value}>
                    <input
                      type="radio"
                      name="pet-pronouns"
                      value={value}
                      checked={petPronouns === value}
                      onChange={() => onPetPronounsChange(value as PetPronouns)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
              <button type="submit" disabled={!analysisId}>
                {analysisId ? "Make their card →" : "Preparing their photo…"}
              </button>
              <button type="button" className="text-button" onClick={() => uploadInput.current?.click()}>
                Choose a different photo
              </button>
            </form>
            {message && <strong>{message}</strong>}
          </div>
        </section>
      )}

      {(flow === "retry" || flow === "refund_pending" || flow === "refunded") && (
        <section className="flow-overlay" aria-live="polite">
          <div className="flow-dialog">
            <span className="pixel-label">
              {flow === "retry" ? "AI RESPONSE COMPLETE · 1 CREDIT USED" : "PAYMENT UPDATE"}
            </span>
            <h2>
              {flow === "retry" ? <>WE NEED MORE<br /><em>OF THEM.</em></> : <>REFUND<br /><em>STARTED.</em></>}
            </h2>
            <p>{message}</p>
            {flow === "retry" && (
              <>
                <button type="button" onClick={() => uploadInput.current?.click()}>
                  Try another photo — uses 1 credit
                </button>
                <a className="text-button" href="/account">View credits and purchases</a>
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
}

type RarityResultScreenProps = {
  flow: FlowState;
  photo: string | null;
  result: AcceptedAnalysis | null;
  exportCardRef: RefObject<HTMLElement | null>;
  onShare: () => void;
  shareBusy: boolean;
  shareLabel: string;
  zazzlePrintEnabled: boolean;
  onOrderPrint: () => void;
  printBusy: boolean;
  printLabel: string;
  creditBalance: number;
  uploadInput: RefObject<HTMLInputElement | null>;
  onReturnHome: () => void;
};

export function RarityResultScreen({
  flow,
  photo,
  result,
  exportCardRef,
  onShare,
  shareBusy,
  shareLabel,
  zazzlePrintEnabled,
  onOrderPrint,
  printBusy,
  printLabel,
  creditBalance,
  uploadInput,
  onReturnHome,
}: RarityResultScreenProps) {
  if (flow !== "completed" || !photo || !result) return null;

  return (
    <section className="result-screen" aria-label="Your rarity card result">
      <div className="story-result">
        <ShareCard photo={photo} result={result} ref={exportCardRef} />
        <div className="result-primary-actions">
          <button className="share-only-button" type="button" onClick={onShare} disabled={shareBusy}>
            <span>{shareLabel}</span><i><Upload /></i>
          </button>
          {zazzlePrintEnabled && (
            <button
              className="share-only-button print-order-button"
              type="button"
              onClick={onOrderPrint}
              disabled={shareBusy || printBusy}
            >
              <span>{printLabel}</span><i><Printer /></i>
            </button>
          )}
          {zazzlePrintEnabled && (
            <small className="print-provider-note">
              Printing, payment, and delivery by Zazzle
            </small>
          )}
        </div>
        <div className="result-account-actions">
          <button type="button" onClick={() => uploadInput.current?.click()}>
            Make another · {creditBalance} left
          </button>
          <a href="/account">View all my cards</a>
          <button type="button" onClick={onReturnHome}>Back to homepage</button>
        </div>
      </div>
    </section>
  );
}
