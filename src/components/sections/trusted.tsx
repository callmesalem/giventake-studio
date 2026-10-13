import { Reveal } from "@/components/reveal";
import { LazyVideo } from "@/components/lazy-video";

/**
 * Honest "trusted partner" band — no fake client logos.
 * A new studio has no client list to display, so this section states
 * what the studio actually does instead of fabricating one.
 */

const facts = [
  { k: "Reports back monthly", v: "Plain-English results" },
  { k: "Direct, no handoffs", v: "Every project" },
  { k: "Weeks, not quarters", v: "Typical timeline" },
  { k: "You own the code", v: "No lock-in" },
];

export function TrustedPartner() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[#06070d]">
      {/* Ambient global-network backdrop — muted autoplay loop, fetched only
          when the section is near the viewport (the poster paints first). */}
      <LazyVideo
        className="absolute inset-0 h-full w-full object-cover opacity-95"
        src="/hero/globe.mp4"
        poster="/hero/globe-poster.webp"
        aria-hidden="true"
      />
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
