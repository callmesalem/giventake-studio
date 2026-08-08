import { Reveal } from "@/components/reveal";
import { IconArrowRight } from "@/components/marks";

const tiers = [
  {
    name: "Essentials",
    price: "$500 - $2.5K",
    tagline: "Small builds, fixes, and single-page sites.",
    features: [
      "One-page site, landing page, or small fix",
      "AI-assisted build with human review",
      "1 revision round included",
      "Mobile responsive and accessible",
      "Source code + deployment handoff",
      "Live in about one week when scope is clear",
      "14 days of tweaks after launch",
    ],
    cta: "Start small",
  },
  {
    name: "Discovery sprint",
    price: "$750 – $1,500",
    tagline: "Not sure what you need built yet? Start here.",
    features: [
      "One to two weeks, fixed fee",
      "We map your current process end to end",
      "Written scope, technical approach, and timeline",
      "A fixed quote for the build",
      "The document is yours either way",
      "Fee credited against the project if you proceed",
    ],
    cta: "Book a sprint",
  },
  {
    name: "Starter",
    price: "From $2,500",
    tagline: "Landing pages and simple builds.",
    features: [
      "Marketing site or landing page",
      "AI-assisted build with human review",
      "2 revision rounds included",
      "CMS your team can edit",
      "Automated tests for critical paths",
      "Source code + deployment handoff",
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
      "Web app, internal tool, or automation",
      "AI agents and agentic workflows where they fit",
      "Scope defined in writing before we start",
      "Unlimited revisions within signed scope",
      "Automated tests + manual QA",
      "Weekly demos and shared roadmap",
      "Source code, docs, and deployment handoff",
      "60 days of support after launch",
    ],
    cta: "Request a quote",
    featured: true,
    // Factual descriptor only. Do not use popularity or social-proof badges
    // ("Most picked", "Most popular") until there is real sales data behind them.
    badge: "Best for custom builds",
  },
  {
    name: "Dedicated",
    price: "Monthly retainer",
    tagline: "An AI-native team, without hiring one.",
    features: [
      "Monthly senior developer retainer",
      "Continuous shipping against your roadmap",
      "AI-assisted delivery with human review",
      "Shared Slack and weekly reviews",
      "Scope adjusts monthly as priorities change",
      "Pause or cancel with 30 days' notice",
    ],
    cta: "Book consultation",
  },
];

const included = [
  "AI-generated code is reviewed by a human before it ships",
  "Automated tests run on every critical path",
  "You receive source code, documentation, and a handoff walkthrough",
  "Timeline and scope are fixed in writing before work starts",
  "Revisions are built into the plan, not billed as surprises",
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-hairline bg-secondary/50">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <Reveal className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">Pricing</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            Work with us the way that fits.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-ink">
            Essentials work starts at $500 for tightly scoped fixes and small builds; most custom
            builds start at $2,500. Every engagement is scoped on a call before a number is quoted,
            and you'll get a fixed price, a clear timeline, and a written statement of what's
            included before any work starts. If the problem isn't defined yet, a discovery sprint
            defines it and the fee comes off the build.
          </p>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <article
                className={`card-lift relative flex h-full flex-col rounded-2xl border p-7 ${
                  t.featured
                    ? "border-ink bg-ink text-white shadow-lift"
                    : "border-hairline bg-white shadow-soft"
                }`}
              >
                {t.badge && (
                  <div className="absolute -top-3 left-7 rounded-full bg-violet px-3 py-1 text-[11px] font-medium text-white">
                    {t.badge}
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
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
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
            </Reveal>
          ))}
        </div>

        {/* transparent expectations block */}
        <Reveal delay={120}>
          <div className="mt-14 rounded-2xl border border-hairline bg-white p-7 shadow-soft">
            <h3 className="text-[18px] font-semibold text-ink">
              What's included with every project
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted-ink">
              Agentic delivery means AI coding agents do the bulk of the construction, and we verify
              the work. Here's what that means for you in practical terms.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {included.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] leading-snug text-ink/85"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
