import { IconArrowRight } from "@/components/marks";

const tiers = [
  {
    name: "Starter",
    price: "From $2,500",
    tagline: "Landing pages and simple builds.",
    features: [
      "Marketing site or landing page",
      "AI-assisted content and code",
      "CMS your team can actually use",
      "Live in two to three weeks",
      "30 days of tweaks after launch",
    ],
    cta: "Start a project",
  },
  {
    name: "Growth",
    price: "Custom quote",
    tagline: "Custom apps, automations, and internal tools.",
    features: [
      "Web app or internal tool built to spec",
      "AI agents and automation where they earn their keep",
      "Weekly demos and a shared roadmap",
      "60 days of support after launch",
    ],
    cta: "Request a quote",
    featured: true,
  },
  {
    name: "Dedicated",
    price: "Monthly retainer",
    tagline: "An AI-native team, without hiring one.",
    features: [
      "Senior developer billed by the month",
      "Continuous shipping against your roadmap",
      "Shared Slack, weekly reviews",
      "Pause or cancel with 30 days' notice",
    ],
    cta: "Book consultation",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-hairline bg-secondary/50">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">Pricing</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            Work with us the way that fits.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-ink">
            Every project gets scoped on a call. You'll have a fixed number and a timeline in writing before we start.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {tiers.map((t) => (
            <article
              key={t.name}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                t.featured
                  ? "border-ink bg-ink text-white shadow-lift"
                  : "border-hairline bg-white shadow-soft"
              }`}
            >
              {t.featured && (
                <div className="absolute -top-3 left-7 rounded-full bg-violet px-3 py-1 text-[11px] font-medium text-white">
                  Most picked
                </div>
              )}
              <h3
                className={`text-[22px] font-semibold tracking-tight ${
                  t.featured ? "text-white" : "text-ink"
                }`}
              >
                {t.name}
              </h3>
              <p
                className={`mt-1.5 text-[14px] ${
                  t.featured ? "text-white/70" : "text-muted-ink"
                }`}
              >
                {t.tagline}
              </p>
              <div
                className={`mt-6 border-t pt-5 ${
                  t.featured ? "border-white/15" : "border-hairline"
                }`}
              >
                <p
                  className={`text-[28px] font-semibold tracking-tight ${
                    t.featured ? "text-white" : "text-ink"
                  }`}
                >
                  {t.price}
                </p>
              </div>
              <ul
                className={`mt-6 flex-1 space-y-3 ${
                  t.featured ? "text-white/85" : "text-ink/85"
                }`}
              >
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14px] leading-snug">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        t.featured ? "bg-violet" : "bg-violet"
                      }`}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className={`mt-8 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-[13px] font-medium transition ${
                  t.featured
                    ? "bg-white text-ink hover:bg-white/90"
                    : "bg-ink text-white hover:opacity-90"
                }`}
              >
                {t.cta}
                <IconArrowRight className="h-4 w-4" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
