import { IconArrowRight } from "@/components/marks";
import { PointerGlow } from "@/components/pointer-glow";
import { HeroVideoPanel } from "@/components/hero-video-panel";

export function Hero() {
  return (
    <section
      data-crit="hero"
      className="hero-elite relative overflow-hidden border-b border-white/10"
    >
      {/* Layered cinematic background — CSS-only, motion-gated, reduced-motion safe */}
      <div aria-hidden="true" className="elite-mesh" />
      <div aria-hidden="true" className="elite-sheen" />
      <div aria-hidden="true" className="elite-grid" />
      <div aria-hidden="true" className="elite-veil" />

      <PointerGlow className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 pt-16 pb-24 md:pt-24 md:pb-32 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        {/* LEFT */}
        <div data-crit="hero-left" className="relative z-10 flex flex-col justify-center">
          <div
            data-crit="hero-badge"
            className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white/70 backdrop-blur rise-in"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 pulse-dot" />
            </span>
            Booking new sites for 2026
          </div>

          {/* LCP element: no entrance animation so it paints on the first frame */}
          <h1
            data-crit="hero-title"
            className="font-display text-[44px] font-medium leading-[0.98] tracking-[-0.035em] text-white sm:text-[56px] md:text-[72px] lg:text-[80px]"
          >
            Your website should bring in work
            <br />
            <span className="text-elite-gradient">and tell you what&rsquo;s working.</span>
          </h1>

          <p
            data-crit="hero-lede"
            className="mt-8 max-w-xl text-[17px] leading-[1.55] text-white/60 md:text-[18px]"
          >
            We&rsquo;re GivenTake Devs, a small studio in Ohio. We build custom websites for small
            businesses starting at $499, quoted in writing before we start. Add the optional $99/mo
            care plan and you get hosting, updates, and a plain-English report every month showing
            where your leads came from and what to fix next.
          </p>

          <div data-crit="hero-cta" className="mt-10 flex flex-wrap items-center gap-3 rise-in">
            <a
              href="/pricing"
              data-crit="hero-cta-primary"
              className="btn-elite btn-icon-nudge inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-medium transition hover:opacity-95"
            >
              See pricing
              <IconArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#site-check"
              data-crit="hero-cta-secondary"
              className="btn-icon-nudge inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3.5 text-[14px] font-medium text-white backdrop-blur transition hover:border-white/40"
            >
              Get a free site check
            </a>
          </div>

          {/* honest status line, no fabricated social proof */}
          <div
            data-crit="hero-note"
            className="mt-12 flex items-start gap-3 border-t border-white/10 pt-6 rise-in"
          >
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400 pulse-dot" />
            <p className="text-[13px] leading-[1.55] text-white/55">
              New studio, taking on our first commissions of 2026. Small team, direct access: you
              always know who you are talking to and who is building your site. No layers in
              between.
            </p>
          </div>
        </div>

        {/* RIGHT — cinematic media slot (video when provided, designed placeholder until then) */}
        <div
          data-crit="hero-right"
          className="relative z-10 flex items-center justify-center lg:justify-end"
        >
          <div data-crit="hero-signature" className="w-full max-w-[520px]">
            <HeroVideoPanel
              src="/hero/giventake-reel.mp4"
              poster="/hero/giventake-reel-poster.jpg"
            />
          </div>
        </div>
      </PointerGlow>
    </section>
  );
}
