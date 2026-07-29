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

          {/* social proof */}
          <div className="mt-12 flex items-center gap-4">
            <div className="flex -space-x-2">
              {[
                "from-violet-400 to-indigo-600",
                "from-amber-300 to-orange-500",
                "from-emerald-300 to-teal-600",
                "from-rose-300 to-pink-500",
                "from-sky-300 to-blue-600",
              ].map((g, i) => (
                <div
                  key={i}
                  className={`h-8 w-8 rounded-full border-2 border-paper bg-gradient-to-br ${g}`}
                />
              ))}
            </div>
            <p className="text-[13px] leading-tight text-muted-ink">
              Trusted by founders and operators
              <br />
              shipping real software in 2026.
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
