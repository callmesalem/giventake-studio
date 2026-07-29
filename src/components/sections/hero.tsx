import { IconArrowRight, IconPlay } from "@/components/marks";
import { BrandSignature } from "@/components/brand-signature";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-hairline">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 pt-16 pb-24 md:pt-24 md:pb-32 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        {/* LEFT */}
        <div className="flex flex-col justify-center rise-in">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-hairline bg-white px-3 py-1.5 text-[12px] font-medium text-muted-ink shadow-soft">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 pulse-dot" />
            </span>
            Booking projects for 2026
          </div>

          <h1 className="font-display text-[44px] font-medium leading-[0.98] tracking-[-0.035em] text-ink sm:text-[56px] md:text-[72px] lg:text-[80px]">
            Stop looking for developers.
            <br />
            <span className="text-muted-ink">Start building.</span>
          </h1>

          <p className="mt-8 max-w-xl text-[17px] leading-[1.55] text-muted-ink md:text-[18px]">
            We're a small development team that businesses hire instead of trying to find, vet, and manage engineers themselves. Tell us what you need built. A few weeks later, you're using it.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14px] font-medium text-white transition hover:opacity-90"
            >
              Start a project
              <IconArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#work"
              className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-5 py-3.5 text-[14px] font-medium text-ink transition hover:border-ink"
            >
              <IconPlay className="h-4 w-4" />
              See the work
            </a>
          </div>

          {/* honest status line — no fabricated social proof */}
          <div className="mt-12 flex items-start gap-3 border-t border-hairline pt-6">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500 pulse-dot" />
            <p className="text-[13px] leading-[1.55] text-muted-ink">
              New studio, taking on our first commissions of 2026. Founder-led,
              so you get direct access to whoever is actually building your product.
            </p>
          </div>
        </div>

        {/* RIGHT — brand signature: The Exchange */}
        <div className="relative flex items-center justify-center lg:justify-end">
          <div className="w-full max-w-[520px]">
            <BrandSignature />
          </div>
        </div>
      </div>
    </section>
  );
}
