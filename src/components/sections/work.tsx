import { ArrowUpRight } from "lucide-react";

const projects = [
  {
    title: "Meridian Ops",
    kind: "Internal Tools",
    body: "Operations dashboard replacing 6 spreadsheets for a logistics team.",
    tech: ["React", "Supabase", "Stripe"],
    gradient: "from-[oklch(0.65_0.19_260)] to-[oklch(0.55_0.18_310)]",
  },
  {
    title: "Northlane AI",
    kind: "AI Application",
    body: "AI intake assistant that qualifies leads and books meetings automatically.",
    tech: ["Next.js", "OpenAI", "Twilio"],
    gradient: "from-[oklch(0.7_0.16_200)] to-[oklch(0.6_0.2_260)]",
  },
  {
    title: "Harbor & Co.",
    kind: "Website",
    body: "Marketing site + CMS for a boutique consultancy. Ships in the founders' voice.",
    tech: ["Astro", "Sanity", "Vercel"],
    gradient: "from-[oklch(0.75_0.14_80)] to-[oklch(0.6_0.18_30)]",
  },
  {
    title: "Cedar Portal",
    kind: "Client Portal",
    body: "White-labeled client portal with document sharing, billing, and approvals.",
    tech: ["React", "Postgres", "Auth"],
    gradient: "from-[oklch(0.7_0.16_160)] to-[oklch(0.55_0.15_220)]",
  },
  {
    title: "Fieldwork",
    kind: "Business Automation",
    body: "Automations connecting CRM, quoting, and invoicing — zero manual data entry.",
    tech: ["n8n", "Airtable", "Stripe"],
    gradient: "from-[oklch(0.68_0.18_20)] to-[oklch(0.55_0.2_340)]",
  },
  {
    title: "Studio Ledger",
    kind: "MVP",
    body: "Booking + payments MVP for a growing studio, launched in six weeks.",
    tech: ["Next.js", "Postgres", "Stripe"],
    gradient: "from-[oklch(0.7_0.15_300)] to-[oklch(0.5_0.18_260)]",
  },
];

export function Work() {
  return (
    <section id="work" className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">Selected work</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Real systems, shipped for real businesses.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            A snapshot of projects across websites, apps, AI, and automation.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <article
              key={p.title}
              className="group overflow-hidden rounded-2xl border border-border/70 bg-card transition hover:border-foreground/20 hover:shadow-[0_20px_40px_-24px_color-mix(in_oklab,var(--brand)_30%,transparent)]"
            >
              <div className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${p.gradient}`}>
                <div className="absolute inset-0 bg-grid opacity-30 mix-blend-overlay" />
                <div className="absolute inset-x-6 bottom-6 rounded-lg border border-white/20 bg-white/10 p-3 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-white/60" />
                    <div className="h-2 w-2 rounded-full bg-white/40" />
                    <div className="h-2 w-2 rounded-full bg-white/30" />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="h-1.5 w-3/4 rounded-full bg-white/40" />
                    <div className="h-1.5 w-1/2 rounded-full bg-white/25" />
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {p.kind}
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">{p.title}</h3>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.tech.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
