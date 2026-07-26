const projects = [
  { title: "Meridian Ops", kind: "Internal Tools", body: "Dispatch and billing dashboard for a 40-truck logistics company. Replaced six shared spreadsheets and a legacy Access database.", tech: ["React", "Postgres", "Stripe"], swatch: "bg-indigo" },
  { title: "Northlane AI", kind: "AI Application", body: "Inbound lead qualifier that reads emails, scores them, and books meetings on the sales team's calendar. Cut response time from a day to under an hour.", tech: ["Next.js", "OpenAI", "Twilio"], swatch: "bg-copper" },
  { title: "Harbor & Co.", kind: "Website", body: "Website and CMS rebuild for a design consultancy. Their team publishes case studies themselves now, without touching a Figma export.", tech: ["Astro", "Sanity", "Vercel"], swatch: "bg-ochre" },
  { title: "Cedar Portal", kind: "Client Portal", body: "Client portal for a boutique accounting firm. Document requests, e-signatures, and billing in one place, branded as theirs.", tech: ["React", "Postgres", "Auth"], swatch: "bg-ink" },
  { title: "Fieldwork", kind: "Automation", body: "Quoting, invoicing, and CRM stitched together for a contracting business. Field crews stopped re-typing job details three times.", tech: ["n8n", "Airtable", "Stripe"], swatch: "bg-copper-deep" },
  { title: "Studio Ledger", kind: "MVP", body: "Booking and payments MVP for a photo studio. Launched in six weeks and paid for itself in the first month of bookings.", tech: ["Next.js", "Postgres", "Stripe"], swatch: "bg-indigo" },
];

export function Work() {
  return (
    <section id="work" className="border-b border-ink/80">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mb-14 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-copper">
              № 06 / The Archive
            </span>
            <h2 className="mt-6 font-display text-4xl font-light leading-[1] tracking-[-0.02em] text-ink md:text-6xl">
              Real systems,
              <br />
              <span className="italic">shipped for real businesses.</span>
            </h2>
          </div>
        </div>

        <div className="grid gap-0 border border-ink md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, i) => (
            <article
              key={p.title}
              className={`group flex flex-col bg-paper transition hover:bg-paper-2/60 ${
                i % 3 !== 2 ? "lg:border-r border-ink/20" : ""
              } ${i < projects.length - 1 ? "border-b border-ink/20" : ""} ${
                i % 2 !== 1 ? "md:border-r md:border-ink/20" : ""
              }`}
            >
              <div className={`relative aspect-[16/10] overflow-hidden border-b border-ink/20 ${p.swatch}`}>
                <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(241,235,221,0.35) 0 1px, transparent 1px 24px), repeating-linear-gradient(0deg, rgba(241,235,221,0.35) 0 1px, transparent 1px 24px)" }} />
                <div className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper/80">
                  Plate {String(i + 1).padStart(2, "0")}
                </div>
                <div className="absolute inset-x-6 bottom-6">
                  <div className="font-display text-2xl italic text-paper">{p.title}</div>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/50">
                    {p.kind}
                  </p>
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-copper transition group-hover:translate-x-1">
                    View →
                  </span>
                </div>
                <h3 className="mt-2 font-display text-2xl font-normal leading-tight text-ink">
                  {p.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink/70">{p.body}</p>
                <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
                  {p.tech.map((t, j) => (
                    <span key={t}>
                      {t}{j < p.tech.length - 1 ? " · " : ""}
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
