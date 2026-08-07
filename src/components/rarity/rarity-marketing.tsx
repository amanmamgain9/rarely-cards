import Link from "next/link";
import { PublicFooter } from "@/components/public-chrome";
import { CreationCards } from "@/components/studio/creation-cards";

const examples = [
  {
    title: "Make one pet talk",
    href: "#maker",
    cta: "Use my photo →",
    video: "/examples/talking-corgi.mp4",
    poster: "/examples/talking-corgi-poster.jpg",
    label: "Talking-pet video example",
    color: "bg-yellow",
  },
  {
    title: "Make a birthday video",
    href: "/studio/create",
    cta: "Make a birthday video →",
    video: "/birthday/five-cats-demo.mp4",
    poster: "/birthday/five-cats-demo-poster.jpg",
    label: "Multi-pet birthday video example",
    color: "bg-purple",
  },
] as const;

export function RarityMarketing() {
  return (
    <>
      <section className="border-t-[3px] border-ink bg-workspace px-[max(1.5rem,calc((100vw-1120px)/2))] py-14 text-ink sm:py-20" aria-labelledby="create-title">
        <h2 className="mb-8 max-w-3xl font-display text-[clamp(2.35rem,6vw,4.5rem)] font-normal leading-none" id="create-title">Choose their next role.</h2>
        <CreationCards signedIn={false} />
      </section>
      <section
        className="border-y-[3px] border-ink bg-cream px-[max(1.5rem,calc((100vw-1120px)/2))] py-14 text-ink sm:py-20"
        id="example"
        aria-labelledby="example-title"
      >
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 className="max-w-3xl font-display text-[clamp(2.35rem,6vw,4.5rem)] font-normal leading-none" id="example-title">
            See what you can make.
          </h2>
          <span className="font-mono text-[9px] font-bold uppercase text-pink">Sound on</span>
        </div>

        <div className="grid gap-7 lg:grid-cols-2">
          {examples.map((example) => (
            <article className={`${example.color} grid gap-6 rounded-[28px] border-[3px] border-ink p-5 shadow-[7px_8px_0_#241a44] sm:grid-cols-[minmax(190px,0.78fr)_minmax(0,1fr)] sm:items-center sm:p-7`} key={example.title}>
              <video
                aria-label={example.label}
                className="mx-auto aspect-[9/16] w-full max-w-[280px] rounded-[22px] border-[3px] border-ink bg-ink object-cover shadow-[5px_6px_0_#f4458f]"
                controls
                playsInline
                poster={example.poster}
                preload="metadata"
                src={example.video}
              />
              <div className="min-w-0">
                <h3 className="font-display text-[clamp(1.65rem,3vw,2.4rem)] font-normal leading-none">{example.title}</h3>
                <Link className="mt-6 inline-flex min-h-12 items-center rounded-xl border-2 border-ink bg-pink px-5 text-sm font-black text-white shadow-[3px_3px_0_#241a44] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none" href={example.href}>
                  {example.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <PublicFooter />
    </>
  );
}
