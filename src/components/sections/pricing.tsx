import { Reveal } from "@/components/reveal";
import { IconArrowRight } from "@/components/marks";

const tiers = [
  {
    name: "Launch",
    price: "$249",
    per: "/mo",
    tagline: "For getting a real site up without a big upfront bill.",
    features: [
      "Custom 5-page site, designed around your customers",
      "Hosting, SSL, and security handled",
      "Content updates included (hours, prices, photos)",
      "Contact form that routes into your inbox",
      "Quarterly performance report in plain English",
      "12-month initial term, then month-to-month",
    ],
    cta: "Start with Launch",
  },
  {
    name: "Growth",
    price: "$399",
    per: "/mo",
    tagline: "For businesses that want the site to pull its weight.",
    features: [
      "Everything in Launch, up to 10 pages",
      "Booking or quote forms wired to your inbox or CRM",
      "Basic local SEO: pages built around what customers search",
      "Google Business Profile wiring",
      "Quarterly report with recommended fixes",
      "12-month initial term, then month-to-month",
    ],
    cta: "Start with Growth",
    featured: true,
    // Factual descriptor of fit, not a popularity claim — no sales data exists yet.
    badge: "Recommended",
  },
  {
    name: "Scale",
    price: "$549",
    per: "/mo",
    tagline: "For businesses ready to treat the site as a growth channel.",
    features: [
      "Everything in Growth, up to 20 pages",
      "AI-search visibility: content structured so ChatGPT, Perplexity, and Google AI cite you",
      "Review pipeline: we help you collect Google reviews every month",
      "Monthly check-in call, quarterly deep report",
      "Priority turnaround on changes",
      "12-month initial term, then month-to-month",
    ],
    cta: "Start with Scale",
  },
];

const alternatives = [
  {
    name: "One-time build",
    price: "From $4,500",
    tagline: "Prefer to own it outright? Same site, same quality.",
    features: [
      "Scoped on a call, fixed price in writing",
      "Hosting ($25/mo) and updates ($50/mo) available as add-ons",
      "30 days of post-launch support included",
    ],
    cta: "Request a build quote",
  },
  {
    name: "Discovery sprint",
    price: "$750 – $1,500",
    tagline: "Not sure what you need yet? Start here.",
    features: [
      "One to two weeks, fixed fee",
      "We map your process end to end",
      "Written scope, approach, timeline, and fixed quote",
      "The document is yours either way. Fee credited if you proceed",
    ],
    cta: "Book a sprint",
  },
];

const included = [
  "You own your domain, your content, and your customer data. Always.",
  "Every site is speed-tested on real phones before launch, and you get the numbers",
  "A human reviews everything before it ships",
  "Changes are one email away. No dashboard to learn, no ticket queue.",
  "Cancel with 30 days' notice after the initial term",
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-hairline bg-secondary/50">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <Reveal className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">Pricing</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            One monthly price. The site and everything it needs.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-ink">
            No $5,000+ upfront invoice, no separate hosting bills, no surprise plugin renewals. Your
            first month is due at signing. That covers the design and build, plus service through
            your first billing date. After a 12-month initial term, everything continues month to
            month.
          </p>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-3">
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
                    <span className="text-[16px] font-medium text-muted-ink">{t.per}</span>
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
                  href="/#contact"
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

        {/* one-time and discovery alternatives */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {alternatives.map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <article className="card-lift flex h-full flex-col rounded-2xl border border-hairline bg-white p-7 shadow-soft md:flex-row md:items-center md:gap-8">
                <div className="flex-1">
                  <h3 className="text-[20px] font-semibold tracking-tight text-ink">{t.name}</h3>
                  <p className="mt-1.5 text-[14px] text-muted-ink">{t.tagline}</p>
                  <ul className="mt-5 space-y-2.5">
                    {t.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2.5 text-[14px] leading-snug text-ink/85"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6 flex flex-col items-start gap-4 md:mt-0 md:items-end">
                  <p className="text-[24px] font-semibold tracking-tight text-ink">{t.price}</p>
                  <a
                    href="/#contact"
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-5 py-3 text-[13px] font-medium text-white transition hover:opacity-90"
                  >
                    {t.cta}
                    <IconArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {/* transparent expectations block */}
        <Reveal delay={120}>
          <div className="mt-14 rounded-2xl border border-hairline bg-white p-7 shadow-soft">
            <h3 className="text-[18px] font-semibold text-ink">What you can count on</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted-ink">
              The fine print, up front. The usual way of buying websites hides it.
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
        {/* non-website work lives on /services; give it a path from here */}
        <Reveal delay={140}>
          <p className="mx-auto mt-12 max-w-2xl text-center text-[15px] leading-relaxed text-muted-ink">
            Need something that isn&rsquo;t a website? Dashboards, automations, and booking systems
            are scoped on a call and priced fixed, in writing.{" "}
            <a
              href="/services"
              className="font-medium text-violet underline-offset-4 hover:underline"
            >
              See services and starting prices
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
