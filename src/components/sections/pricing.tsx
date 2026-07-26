const tiers = [
  {
    mark: "I",
    name: "Starter",
    price: "From $2,500",
    tagline: "Landing pages and simple builds.",
    features: [
      "Marketing site or landing page",
      "CMS and basic integrations",
      "Launch in 2 to 3 weeks",
      "30 days of post-launch support",
    ],
    cta: "Start a project",
  },
  {
    mark: "II",
    name: "Growth",
    price: "Custom quote",
    tagline: "Custom systems, apps, and automations.",
    features: [
      "Web app or internal tool",
      "AI and automation integrations",
      "Weekly demos, clear milestones",
      "60 days of post-launch support",
    ],
    cta: "Request a quote",
    featured: true,
  },
  {
    mark: "III",
    name: "Dedicated",
    price: "Monthly retainer",
    tagline: "An ongoing team, without hiring.",
    features: [
      "Senior team by the month",
      "Continuous shipping",
      "Direct Slack access, weekly reviews",
      "Pause or cancel any time",
    ],
    cta: "Book consultation",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-ink/80 bg-paper-2/40">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mb-14 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-copper">
              № 08 / The Terms
            </span>
            <h2 className="mt-6 font-display text-4xl font-light leading-[1] tracking-[-0.02em] text-ink md:text-6xl">
              Work with us
              <br />
              <span className="italic">the way that fits.</span>
            </h2>
          </div>
          <p className="col-span-12 max-w-md font-display text-xl italic leading-snug text-ink/70 lg:col-span-4 lg:self-end">
            Every project is scoped after a call. No fixed packages, just clear numbers before we start.
          </p>
        </div>

        <div className="grid gap-0 border border-ink md:grid-cols-3">
          {tiers.map((t, i) => (
            <article
              key={t.name}
              className={`relative flex flex-col bg-paper p-8 ${
                i < tiers.length - 1 ? "border-b border-ink md:border-b-0 md:border-r" : ""
              } ${t.featured ? "bg-ink text-paper" : ""}`}
            >
              {t.featured && (
                <div className="absolute -top-3 left-8 border border-ink bg-copper px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper">
                  Most projects
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className={`font-display text-5xl font-light italic ${t.featured ? "text-copper" : "text-copper"}`}>
                  {t.mark}
                </span>
                <span className={`font-mono text-[10px] uppercase tracking-[0.22em] ${t.featured ? "text-paper/60" : "text-ink/50"}`}>
                  Tier {i + 1}
                </span>
              </div>
              <h3 className={`mt-6 font-display text-3xl font-normal leading-tight ${t.featured ? "text-paper" : "text-ink"}`}>
                {t.name}
              </h3>
              <p className={`mt-1 text-[14px] ${t.featured ? "text-paper/70" : "text-ink/60"}`}>
                {t.tagline}
              </p>
              <div className={`mt-6 border-t pt-4 ${t.featured ? "border-paper/20" : "border-ink/20"}`}>
                <p className={`font-mono text-[10px] uppercase tracking-[0.22em] ${t.featured ? "text-paper/50" : "text-ink/50"}`}>
                  Investment
                </p>
                <p className={`mt-1 font-display text-2xl italic ${t.featured ? "text-paper" : "text-ink"}`}>
                  {t.price}
                </p>
              </div>
              <ul className={`mt-6 flex-1 space-y-3 ${t.featured ? "text-paper/85" : "text-ink/80"}`}>
                {t.features.map((f) => (
                  <li key={f} className="flex items-baseline gap-3 text-[14.5px] leading-snug">
                    <span className="font-mono text-copper">+</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className={`mt-8 inline-flex items-center justify-center border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] transition ${
                  t.featured
                    ? "border-copper bg-copper text-paper hover:bg-transparent hover:text-copper"
                    : "border-ink bg-ink text-paper hover:bg-copper hover:border-copper"
                }`}
              >
                {t.cta} →
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
