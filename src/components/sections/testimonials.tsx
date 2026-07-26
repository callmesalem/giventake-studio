const testimonials = [
  {
    quote:
      "We went from a Notion doc to a working product in six weeks. It's the closest thing to hiring a CTO without hiring a CTO.",
    name: "Alex Rivera",
    role: "Founder, Northlane",
  },
  {
    quote:
      "They replaced three tools and a part-time contractor. Our team actually enjoys using what they built for us.",
    name: "Priya Menon",
    role: "COO, Meridian Logistics",
  },
  {
    quote:
      "Every week there was a demo. Every week it got better. I never had to translate my ideas into 'engineer'.",
    name: "James Whitaker",
    role: "Owner, Harbor & Co.",
  },
];

export function Testimonials() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">Testimonials</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Trusted by founders and operators.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-7"
            >
              <blockquote className="text-[15px] leading-relaxed text-foreground">
                <span className="text-brand">"</span>
                {t.quote}
                <span className="text-brand">"</span>
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-[oklch(0.5_0.2_310)] text-xs font-semibold text-brand-foreground">
                  {t.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-tight">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
