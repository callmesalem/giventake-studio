import { IconPlay } from "@/components/marks";

/**
 * Cinematic hero media slot.
 *
 * Renders a real autoplay-muted-loop video when a `src` is provided (poster
 * paints first, the file is `preload="none"` so it never blocks the LCP
 * headline). Until Salem drops in the GivenTake footage it shows a designed
 * "showreel" placeholder rather than an empty box — so the slot reads as
 * intentional, not broken.
 */
export function HeroVideoPanel({ src, poster }: { src?: string; poster?: string }) {
  return (
    <div className="video-frame aspect-[4/5] w-full">
      <div className="vf-glow" aria-hidden="true" />
      <div className="relative z-10 h-full w-full">
        {src ? (
          <video
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            poster={poster}
          >
            <source src={src} />
          </video>
        ) : (
          <PlaceholderReel />
        )}
      </div>
    </div>
  );
}

/** Designed placeholder: a faux product surface with a play affordance. */
function PlaceholderReel() {
  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,#0e1022,#0a0b16_60%,#070812)] p-5">
      {/* faux window chrome */}
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <span className="ml-3 h-2 w-24 rounded-full bg-white/10" />
      </div>

      {/* faux dashboard blocks with gradient fills */}
      <div className="grid grid-cols-2 gap-3" aria-hidden="true">
        <div className="col-span-2 h-20 rounded-xl border border-white/10 bg-[linear-gradient(120deg,color-mix(in_oklab,var(--e-1)_55%,transparent),color-mix(in_oklab,var(--e-3)_35%,transparent))]" />
        <div className="h-16 rounded-xl border border-white/10 bg-white/[0.04]" />
        <div className="h-16 rounded-xl border border-white/10 bg-white/[0.04]" />
        <div className="col-span-2 h-2.5 w-3/4 rounded-full bg-white/10" />
        <div className="col-span-2 h-2.5 w-1/2 rounded-full bg-white/[0.07]" />
      </div>

      {/* play affordance + label */}
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/10 backdrop-blur">
          <IconPlay className="h-4 w-4 translate-x-[1px] text-white" />
        </span>
        <div className="leading-tight">
          <p className="text-[13px] font-medium text-white">See it in motion</p>
          <p className="text-[11px] text-white/50">Product showreel. Coming soon</p>
        </div>
      </div>
    </div>
  );
}
