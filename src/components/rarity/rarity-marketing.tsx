import Image from "next/image";
import { ShareCard } from "@/components/share-card";
import { Star } from "@/components/rarity/rarity-icons";
import { HERO_CARD_DEMOS } from "@/components/rarity/rarity-model";

export function RarityMarketing() {
  return (
    <>
      <section className="clarity-section" id="example">
        <div className="clarity-heading">
          <span className="pixel-label">WHAT RARELY ACTUALLY DOES</span>
          <h2>ONE PHOTOGRAPH GOES IN.<br />A CARD ONLY <em>THEY</em> COULD WEAR COMES OUT.</h2>
          <p>
            This is not a breed test or a generic compliment generator. We use
            visible evidence from the whole frame to make one funny, specific,
            emotionally honest card you can save or post.
          </p>
        </div>
        <div className="clarity-grid">
          <article className="clarity-step">
            <span className="clarity-number">01</span>
            <figure>
              <Image
                src="/pets/window-cat.jpg"
                alt="Cat watching a pink sunset through an open window"
                fill
                sizes="(max-width: 760px) 92vw, 30vw"
              />
              <figcaption>ONE CLEAR CAT OR DOG</figcaption>
            </figure>
            <h3>YOU SEND THE PHOTO</h3>
            <p>Close-up or full scene. We want the ears, stare, posture, light, and little territory they claimed.</p>
          </article>
          <article className="clarity-step clarity-read">
            <span className="clarity-number">02</span>
            <figure>
              <Image
                src="/pets/quiet-dog.jpg"
                alt="Beagle looking directly into the camera"
                fill
                sizes="(max-width: 760px) 92vw, 30vw"
              />
              <div className="trait-tags" aria-hidden="true">
                <i>AURA</i><i>SCENE LORE</i><i>DRAMA</i><i>GAZE</i>
              </div>
            </figure>
            <h3>WE READ THE WHOLE FRAME</h3>
            <p>No breed quiz. No personality form. Cat or dog is automatic; every claim must be visible in the image.</p>
          </article>
          <article className="clarity-step clarity-output">
            <span className="clarity-number">03</span>
            <div className="clarity-card-preview">
              <ShareCard
                photo={HERO_CARD_DEMOS[0].image}
                result={HERO_CARD_DEMOS[0].result}
              />
            </div>
            <h3>YOU GET THEIR CARD</h3>
            <p>Their look, their imagined voice, their one-of-one card—ready to keep or send to everyone who knows them.</p>
          </article>
        </div>
        <blockquote>
          YOU TOOK A THOUSAND PHOTOS BECAUSE SOME PART OF YOU UNDERSTOOD.
        </blockquote>
      </section>

      <section className="stats-strip" id="stats">
        <div className="ticker">
          <span>★ THE PHOTO YOU KEEP COMING BACK TO</span><span>★ THE PHOTO YOU KEEP COMING BACK TO</span>
          <span>★ THE PHOTO YOU KEEP COMING BACK TO</span><span>★ THE PHOTO YOU KEEP COMING BACK TO</span>
        </div>
        <div className="stats-content">
          <div className="stats-heading">
            <span className="pixel-label">THE LOOK ONLY YOU UNDERSTAND</span>
            <h2>DON&apos;T JUST SAVE<br />THE PHOTO. <em>SAVE THE LOOK.</em></h2>
            <p>
              Your camera roll holds the moment. Rarely gives it the voice you
              already hear—the line that makes you laugh because it could only be them.
            </p>
          </div>
          <div className="keepsake-proof">
            <span>THE REACTION WE&apos;RE AFTER</span>
            <blockquote>“THAT IS<br />SO THEM.”</blockquote>
            <p>
              The instant send-to-everyone kind of recognition. One photo becomes
              a card that feels less like content and more like an inside joke you get to keep.
            </p>
            <a href="#maker">Get 5 card credits — $5 <b>→</b></a>
          </div>
        </div>
      </section>

      <section className="how" id="how">
        <span className="pixel-label">THEY HAVE BEEN SAYING IT WITH THEIR FACE.</span>
        <h2>YOU KNOW THE LOOK.<br /><em>WE PUT IT ON A CARD.</em></h2>
        <div className="steps">
          {[
            ["01", "WE CATCH THE LOOK", "The stare, ears, posture, and tiny details that make you say, “there you are.”"],
            ["02", "WE FIND THEIR VOICE", "A funny inner thought that sounds like the version of them already living in your head."],
            ["03", "YOU KEEP THE PROOF", "A polished one-of-one card made to save, share, and send to everyone who knows them."],
          ].map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span><div className={`step-icon step-${number}`}><Star /><i /></div>
              <h3>{title}</h3><p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <footer>
        <a className="brand footer-brand" href="#">RARELY <span><Star /></span></a>
        <p>Not built to blend in.</p>
        <span className="footer-links">
          <a href="/pricing">Pricing</a> · <a href="/refund-policy">Refunds</a> ·{" "}
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> ·{" "}
          <a href="/contact">Contact</a>
        </span>
      </footer>
    </>
  );
}
