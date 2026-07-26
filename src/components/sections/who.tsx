import { Store, Lightbulb, TrendingUp } from "lucide-react";

const cards = [
  {
    icon: Store,
    title: "Small Businesses",
    body: "Modernize your operations with websites, portals, and automations that replace the patchwork of tools you're paying for today.",
  },
  {
    icon: Lightbulb,
    title: "Founders",
    body: "You have the idea and the customers. We become the technical co-founder you'd otherwise spend a year searching for.",
  },
  {
    icon: TrendingUp,
    title: "Growing Companies",
    body: "Ship product without a hiring cycle. A senior team that plugs in when you need it and steps back when you don't.",
  },
];

export function WhoWeHelp() {
  return (
    <section id="who" className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">Who we help</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Built for the people running the business.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Whether it's your first product or your fifth internal tool, we meet you where you are.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="group relative rounded-2xl border border-border/70 bg-card p-7 transition hover:border-foreground/20 hover:shadow-[0_1px_0_0_var(--border),0_20px_40px_-20px_color-mix(in_oklab,var(--brand)_20%,transparent)]"
            >
              <div className="mb-8 grid h-10 w-10 place-items-center rounded-lg border border-border/70 bg-background">
                <Icon className="h-5 w-5 text-brand" strokeWidth={1.6} />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
