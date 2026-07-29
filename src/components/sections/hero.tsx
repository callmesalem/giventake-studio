import { IconArrowRight, IconPlay } from "@/components/marks";

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

        {/* RIGHT — floating mockup cards */}
        <div className="relative min-h-[520px] lg:min-h-[600px]">
          {/* Card 1 — Booking calendar */}
          <div className="absolute right-0 top-0 w-[280px] rounded-2xl border border-hairline bg-white p-4 shadow-lift float-a sm:w-[320px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-ink">
                  New booking
                </p>
                <p className="mt-0.5 text-[15px] font-semibold text-ink">
                  Confirmed · Thu 4:30pm
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-300 to-teal-600" />
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1 text-center">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={i} className="text-[10px] font-medium text-muted-ink">{d}</div>
              ))}
              {Array.from({ length: 21 }).map((_, i) => {
                const active = i === 10;
                const hot = i === 11;
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-md text-[10px] font-medium ${
                      active
                        ? "bg-ink text-white"
                        : hot
                        ? "bg-violet-soft text-violet"
                        : "bg-secondary text-muted-ink"
                    }`}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-violet-soft px-2.5 py-2 text-[12px] font-medium text-violet">
              <span className="h-1.5 w-1.5 rounded-full bg-violet" />
              2 open slots this week
            </div>
          </div>

          {/* Card 2 — Admin dashboard */}
          <div className="absolute left-0 top-[220px] w-[300px] rounded-2xl border border-hairline bg-white p-4 shadow-lift float-b sm:w-[340px]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-ink">
                Ops overview
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { l: "Jobs", v: "24" },
                { l: "Invoices", v: "12" },
                { l: "MRR", v: "$18.4k" },
              ].map((k) => (
                <div key={k.l}>
                  <p className="text-[10px] font-medium text-muted-ink">{k.l}</p>
                  <p className="mt-0.5 text-[18px] font-semibold tracking-tight text-ink">{k.v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex h-16 items-end gap-1.5">
              {[40, 60, 45, 72, 55, 82, 68, 90, 74, 88, 95, 78].map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t ${i === 11 ? "bg-ink" : "bg-secondary"}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Card 3 — AI intake */}
          <div className="absolute right-4 top-[420px] w-[290px] rounded-2xl border border-hairline bg-white p-4 shadow-lift float-c sm:w-[330px]">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-soft">
                <span className="text-[13px] font-semibold text-violet">M</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-[13px] font-semibold text-ink">Maya · Acme Co.</p>
                  <span className="text-[10px] text-muted-ink">2m</span>
                </div>
                <p className="text-[11px] text-muted-ink">Auto-summarized by intake</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-snug text-ink">
              Founder, needs an MVP client portal wired to their existing Stripe. Wants a call this week.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Founder", "MVP", "Priority"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-hairline bg-secondary px-2 py-0.5 text-[10px] font-medium text-ink"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
