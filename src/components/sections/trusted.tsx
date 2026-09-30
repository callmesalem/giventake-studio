import { Reveal } from "@/components/reveal";

/**
 * Honest "trusted partner" band — no fake client logos.
 * A new studio has no client list to display, so this section states
 * what the studio actually does instead of fabricating one.
 */

const facts = [
  { k: "Reports back quarterly", v: "Plain-English results" },
  { k: "Direct, no handoffs", v: "Every project" },
  { k: "Weeks, not quarters", v: "Typical timeline" },
  { k: "You own the code", v: "No lock-in" },
];

export function TrustedPartner() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[#06070d]">
      {/* Ambient global-network backdrop — muted autoplay loop, reduced-motion
          safe (the poster paints and the file is preload="none"). */}
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-95"
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="/hero/globe-poster.jpg"
        aria-hidden="true"
      >
        <source src="/hero/globe.mp4" type="video/mp4" />
      </video>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,7,13,.78),rgba(6,7,13,.3)_50%,rgba(6,7,13,.78))]"
      />
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-14">
        <Reveal>
          <p className="text-center text-[12px] font-medium uppercase tracking-[0.18em] text-white/55">
            What working with us actually looks like
          </p>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
          {facts.map((f, i) => (
            <Reveal key={f.k} delay={i * 60}>
              <div className="flex flex-col items-center text-center">
                <div className="text-[18px] font-semibold tracking-tight text-white">{f.k}</div>
                <div className="mt-1 text-[12px] text-white/60">{f.v}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
