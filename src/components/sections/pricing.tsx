import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Starter",
    price: "From $2,500",
    tagline: "Landing pages and simple builds.",
    features: [
      "Marketing site or landing page",
      "CMS + basic integrations",
      "Launch in 2–3 weeks",
      "30 days of post-launch support",
    ],
    cta: "Start a project",
    featured: false,
  },
  {
    name: "Growth",
    price: "Custom quote",
    tagline: "Custom systems, apps, and automations.",
    features: [
      "Web app or internal tool",
      "AI + automation integrations",
      "Weekly demos, milestones",
      "60 days of post-launch support",
    ],
    cta: "Get a quote",
    featured: true,
  },
  {
    name: "Dedicated Development",
    price: "Retainer",
    tagline: "An ongoing team, without hiring.",
    features: [
      "Senior team by the month",
      "Continuous shipping",
      "Slack access, weekly reviews",
      "Pause or cancel any time",
    ],
    cta: "Book consultation",
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">Engagement</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Work with us the way that fits.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every project is scoped after a call. No fixed packages — just clear numbers before we start.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {tiers.map((t) => (
            <article
              key={t.name}
              className={`relative flex flex-col rounded-2xl border p-7 transition ${
                t.featured
                  ? "border-foreground/20 bg-card shadow-[0_30px_60px_-30px_color-mix(in_oklab,var(--brand)_40%,transparent)]"
                  : "border-border/70 bg-card"
              }`}
            >
              {t.featured && (
                <div className="absolute -top-3 left-7 rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-[11px] font-medium text-brand">
                  Most projects
                </div>
              )}
              <div>
                <h3 className="text-base font-semibold tracking-tight">{t.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t.tagline}</p>
              </div>
              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight">{t.price}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/90">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                variant={t.featured ? "default" : "outline"}
                className="mt-8 h-10 rounded-full"
              >
                <a href="#contact">{t.cta}</a>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
