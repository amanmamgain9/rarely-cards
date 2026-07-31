import Image from "next/image";
import { Star } from "@/components/rarity/rarity-icons";
import { PublicFooter } from "@/components/public-chrome";

export function RarityMarketing() {
  return (
    <>
      <section className="border-y-[3px] border-ink bg-cream px-[max(1.5rem,calc((100vw-1240px)/2))] py-24 text-ink" id="example">
        <div className="mx-auto mb-14 max-w-4xl text-center">
          <span className="inline-flex rounded-md border-2 border-ink bg-yellow px-3 py-1 font-mono text-[9px] font-medium shadow-[3px_3px_0_#241a44]">WHAT RARELY ACTUALLY DOES</span>
          <h2 className="my-6 font-display text-[clamp(2.75rem,6vw,5rem)] font-normal leading-none">ONE PHOTOGRAPH GOES IN.<br /><em className="not-italic text-pink">THEIR VOICE</em> COMES OUT.</h2>
          <p className="mx-auto max-w-2xl text-lg font-bold leading-relaxed text-ink-muted">
            Rarely reads the look, gives you three lines that fit the moment,
            and turns your favorite into an eight-second talking-pet reel.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <article className="relative rounded-2xl border-[3px] border-ink bg-white p-5 shadow-[6px_7px_0_#241a44]">
            <span className="absolute -left-3 -top-3 z-10 grid size-10 place-items-center rounded-full border-2 border-ink bg-yellow font-display">01</span>
            <figure className="relative m-0 aspect-[4/5] overflow-hidden rounded-xl border-2 border-ink">
              <Image
                src="/pets/window-cat.jpg"
                alt="Cat watching a pink sunset through an open window"
                fill
                sizes="(max-width: 760px) 92vw, 30vw"
              />
              <figcaption className="absolute bottom-3 left-3 rounded bg-yellow px-2 py-1 font-mono text-[8px] font-bold">ONE CLEAR CAT OR DOG</figcaption>
            </figure>
            <h3 className="mb-2 mt-5 font-display text-xl font-normal">YOU SEND THE PHOTO</h3>
            <p className="text-sm font-bold leading-relaxed text-ink-muted">Close-up or full scene. We want the ears, stare, posture, light, and little territory they claimed.</p>
          </article>
          <article className="relative rounded-2xl border-[3px] border-ink bg-white p-5 shadow-[6px_7px_0_#241a44]">
            <span className="absolute -left-3 -top-3 z-10 grid size-10 place-items-center rounded-full border-2 border-ink bg-pink font-display text-white">02</span>
            <figure className="relative m-0 aspect-[4/5] overflow-hidden rounded-xl border-2 border-ink">
              <Image
                src="/pets/quiet-dog.jpg"
                alt="Beagle looking directly into the camera"
                fill
                sizes="(max-width: 760px) 92vw, 30vw"
              />
              <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1" aria-hidden="true">
                {['AURA', 'SCENE LORE', 'DRAMA', 'GAZE'].map((tag) => <i className="rounded bg-ink px-2 py-1 font-mono text-[7px] not-italic text-white" key={tag}>{tag}</i>)}
              </div>
            </figure>
            <h3 className="mb-2 mt-5 font-display text-xl font-normal">YOU PICK THEIR LINE</h3>
            <p className="text-sm font-bold leading-relaxed text-ink-muted">Funny, sweet, chaotic, or your own words. No prompts, camera controls, or directing required.</p>
          </article>
          <article className="relative rounded-2xl border-[3px] border-ink bg-white p-5 shadow-[6px_7px_0_#241a44]">
            <span className="absolute -left-3 -top-3 z-10 grid size-10 place-items-center rounded-full border-2 border-ink bg-purple font-display">03</span>
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border-2 border-ink">
              <Image
                src="/pets/window-cat.jpg"
                alt="A vertical talking-pet video preview"
                fill
                sizes="(max-width: 760px) 92vw, 30vw"
              />
              <span className="absolute left-3 top-3 rounded bg-ink/80 px-2 py-1 font-mono text-[7px] text-white">RARELY · ORIGINAL AUDIO</span>
              <blockquote className="absolute bottom-4 left-3 right-3 m-0 font-display text-lg leading-tight text-white [text-shadow:1px_1px_0_#241a44]">“I was watching the sunset. You interrupted.”</blockquote>
            </div>
            <h3 className="mb-2 mt-5 font-display text-xl font-normal">THEY SAY IT OUT LOUD</h3>
            <p className="text-sm font-bold leading-relaxed text-ink-muted">An eight-second vertical video with synchronized speech, ready for your camera roll or Instagram.</p>
          </article>
        </div>
        <blockquote className="mx-auto mb-0 mt-16 max-w-4xl text-center font-display text-[clamp(1.5rem,4vw,2.5rem)] leading-tight text-pink">
          YOU TOOK A THOUSAND PHOTOS BECAUSE SOME PART OF YOU UNDERSTOOD.
        </blockquote>
      </section>

      <section className="border-b-[3px] border-ink bg-ink text-cream" id="stats">
        <div className="flex overflow-hidden border-b-2 border-yellow bg-pink py-3 font-mono text-[9px] font-bold text-white">
          <span>★ THE PHOTO YOU KEEP COMING BACK TO</span><span>★ THE PHOTO YOU KEEP COMING BACK TO</span>
          <span>★ THE PHOTO YOU KEEP COMING BACK TO</span><span>★ THE PHOTO YOU KEEP COMING BACK TO</span>
        </div>
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 lg:grid-cols-2">
          <div>
            <span className="font-mono text-[9px] font-bold text-pink">THE LOOK ONLY YOU UNDERSTAND</span>
            <h2 className="my-5 font-display text-[clamp(2.75rem,5vw,4.5rem)] font-normal leading-none">DON&apos;T JUST SAVE<br />THE PHOTO. <em className="not-italic text-yellow">SAVE THE LOOK.</em></h2>
            <p className="text-lg font-bold leading-relaxed text-[#cdbfe0]">
              Your camera roll holds the moment. Rarely gives it the voice you
              already hear—the line that makes you laugh because it could only be them.
            </p>
          </div>
          <div className="rotate-1 rounded-2xl border-[3px] border-ink bg-yellow p-8 text-ink shadow-[8px_9px_0_#f4458f]">
            <span className="font-mono text-[9px] font-bold">THE REACTION WE&apos;RE AFTER</span>
            <blockquote className="my-5 font-display text-[clamp(3rem,6vw,5rem)] leading-none">“THAT IS<br />SO THEM.”</blockquote>
            <p className="font-bold leading-relaxed text-ink-muted">
              The instant send-to-everyone kind of recognition. One photo becomes
              a tiny performance that feels like the inside joke only you understand.
            </p>
            <a className="mt-6 inline-flex rounded-xl border-2 border-ink bg-pink px-5 py-3 font-mono text-[10px] font-bold text-white shadow-[3px_3px_0_#241a44]" href="#maker">Get 3 talking-pet videos — $10 <b>→</b></a>
          </div>
        </div>
      </section>

      <section className="bg-soft-pink px-[max(1.5rem,calc((100vw-1120px)/2))] py-24 text-center text-ink" id="how">
        <span className="font-mono text-[9px] font-bold">THEY HAVE BEEN SAYING IT WITH THEIR FACE.</span>
        <h2 className="my-6 font-display text-[clamp(2.75rem,6vw,5rem)] font-normal leading-none">YOU KNOW THE LOOK.<br /><em className="not-italic text-pink">NOW LET THEM SAY IT.</em></h2>
        <div className="grid overflow-hidden rounded-3xl border-[3px] border-ink bg-cream shadow-[9px_9px_0_#241a44] lg:grid-cols-3">
          {[
            ["01", "ADD ONE PHOTO", "Choose the stare, nap, side-eye, or suspiciously innocent moment that feels most like them."],
            ["02", "PICK ONE LINE", "Tap a suggestion inspired by the photo or write exactly what you hear in their head."],
            ["03", "SHARE THE VIDEO", "Rarely handles the motion, voice, and timing. Save the reel or share it straight from your phone."],
          ].map(([number, title, copy]) => (
            <article className="border-ink p-8 not-last:border-b-[3px] lg:not-last:border-b-0 lg:not-last:border-r-[3px]" key={number}>
              <span className="font-mono text-[10px] font-bold text-pink">{number}</span><div className="mx-auto my-5 grid size-20 place-items-center rounded-full border-[3px] border-ink bg-yellow shadow-[5px_5px_0_#241a44] [&>svg]:w-9"><Star /></div>
              <h3 className="font-display text-xl font-normal">{title}</h3><p className="mt-3 text-sm font-bold leading-relaxed text-ink-muted">{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <PublicFooter />
    </>
  );
}
