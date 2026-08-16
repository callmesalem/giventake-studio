import { IconArrowRight, IconPlay } from "@/components/marks";
import { BrandSignature } from "@/components/brand-signature";
import { PointerGlow } from "@/components/pointer-glow";

export function Hero() {
  return (
    <section data-crit="hero" className="relative overflow-hidden border-b border-hairline">
      {/* Premium animated background — CSS-only, motion-gated, reduced-motion safe */}
      <div aria-hidden="true" className="hero-aurora">
        <div className="aurora-orb -top-32 -left-24 h-[480px] w-[480px] bg-[var(--hero-glow-1)]" />
        <div className="aurora-orb top-[35%] -right-32 h-[420px] w-[420px] bg-[var(--hero-glow-2)]" />
        <div className="aurora-orb bottom-[-80px] left-[40%] h-[320px] w-[320px] bg-[var(--hero-glow-3)]" />
      </div>

      <PointerGlow className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 pt-16 pb-24 md:pt-24 md:pb-32 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        {/* LEFT */}
        <div data-crit="hero-left" className="relative z-10 flex flex-col justify-center">
          <div
            data-crit="hero-badge"
            className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-hairline bg-white px-3 py-1.5 text-[12px] font-medium text-muted-ink shadow-soft rise-in"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 pulse-dot" />
            </span>
            Booking projects for 2026
          </div>

          {/* LCP element: no entrance animation so it paints on the first frame */}
          <h1
            data-crit="hero-title"
            className="font-display text-[44px] font-medium leading-[0.98] tracking-[-0.035em] text-ink sm:text-[56px] md:text-[72px] lg:text-[80px]"
          >
            Software for the parts you're
            <br />
            <span className="text-muted-ink">still doing by hand.</span>
          </h1>

          <p
            data-crit="hero-lede"
            className="mt-8 max-w-xl text-[17px] leading-[1.55] text-muted-ink md:text-[18px]"
          >
            We build the software small businesses actually run on: dashboards that replace five
            spreadsheets, booking that ends the phone tag, intake that sorts itself. Built by
            someone who runs operations-heavy businesses, not an agency layering on overhead. Tell
            us what's eating your week. A few weeks later, you're using the fix.
          </p>

          <div data-crit="hero-cta" className="mt-10 flex flex-wrap items-center gap-3 rise-in">
            <a
              href="#contact"
              data-crit="hero-cta-primary"
              className="btn-icon-nudge inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14px] font-medium text-white transition hover:opacity-90"
            >
              Start a project
              <IconArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#work"
              data-crit="hero-cta-secondary"
              className="btn-icon-nudge inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-5 py-3.5 text-[14px] font-medium text-ink transition hover:border-ink"
            >
              <IconPlay className="h-4 w-4" />
              See the work
            </a>
          </div>

          {/* honest status line, no fabricated social proof */}
          <div
            data-crit="hero-note"
            className="mt-12 flex items-start gap-3 border-t border-hairline pt-6 rise-in"
          >
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500 pulse-dot" />
            <p className="text-[13px] leading-[1.55] text-muted-ink">
              New studio, taking on our first commissions of 2026. AI-assisted delivery means faster
              prototypes and fewer handoffs. You deal with the studio directly — no account
              managers, no work passed down a chain.
            </p>
          </div>
        </div>

        {/* RIGHT — brand signature: The Exchange */}
        <div
          data-crit="hero-right"
          className="relative z-10 flex items-center justify-center lg:justify-end"
        >
          <div data-crit="hero-signature" className="w-full max-w-[520px]">
            <BrandSignature />
          </div>
        </div>
      </PointerGlow>
    </section>
  );
}
