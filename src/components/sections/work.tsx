const commissions = [
  {
    title: "A booking system for a service business",
    kind: "Client Software",
    body: "Customers book, pay, and reschedule themselves. You stop living in your inbox and text messages.",
    tags: ["Scheduling", "Payments", "Client Portal"],
    swatch: "bg-indigo",
  },
  {
    title: "An internal dashboard replacing spreadsheets",
    kind: "Internal Tools",
    body: "One place to see jobs, invoices, and status, instead of five shared Google Sheets nobody trusts.",
    tags: ["Dashboards", "Postgres", "Auth"],
    swatch: "bg-copper",
  },
  {
    title: "An AI-assisted intake tool",
    kind: "AI Application",
    body: "Leads or requests come in, get summarized, tagged, and routed. Your team acts on real signal, not raw inbox.",
    tags: ["LLMs", "Automation", "Email"],
    swatch: "bg-ochre",
  },
  {
    title: "A rebuilt marketing site",
    kind: "Website",
    body: "A site that reflects what your business actually does now, with a CMS your team can update without a developer.",
    tags: ["Next.js", "CMS", "SEO"],
    swatch: "bg-ink",
  },
];

export function Work() {
  return (
    <section id="work" className="border-b border-ink/80">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mb-14 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-9">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-copper">
              № 06 / The Roster
            </span>
            <h2 className="mt-6 font-display text-4xl font-light leading-[1] tracking-[-0.02em] text-ink md:text-6xl">
              Taking on our first
              <br />
              <span className="italic">commissions of 2026.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink/70">
              We're a new studio. That means founder-level attention on every project, and rates
              that reflect a team building its own track record, not agency overhead.
            </p>
          </div>
        </div>

        <div className="grid gap-0 border border-ink md:grid-cols-2">
          {commissions.map((p, i) => (
            <article
              key={p.title}
              className={`group flex flex-col bg-paper transition hover:bg-paper-2/60 ${
                i % 2 === 0 ? "md:border-r md:border-ink/20" : ""
              } ${i < commissions.length - 2 ? "border-b border-ink/20" : "border-b border-ink/20 md:border-b-0"} ${
                i === commissions.length - 2 ? "md:border-b-0" : ""
              }`}
            >
              <div className={`relative aspect-[16/7] overflow-hidden border-b border-ink/20 ${p.swatch}`}>
                <div
                  className="absolute inset-0 opacity-25"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, rgba(241,235,221,0.35) 0 1px, transparent 1px 24px), repeating-linear-gradient(0deg, rgba(241,235,221,0.35) 0 1px, transparent 1px 24px)",
                  }}
                />
                <div className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper/80">
                  Commission {String(i + 1).padStart(2, "0")}
                </div>
                <div className="absolute left-6 bottom-6 right-6">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/70">
                    {p.kind}
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-display text-2xl font-normal leading-tight text-ink">
                  {p.title}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-ink/70">{p.body}</p>
                <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
                  {p.tags.map((t, j) => (
                    <span key={t}>
                      {t}
                      {j < p.tags.length - 1 ? " · " : ""}
                    </span>
                  ))}
                </div>
                <div className="mt-6 flex items-baseline justify-between border-t border-ink/20 pt-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/50">
                    Available now
                  </span>
                  <a
                    href="#contact"
                    className="font-mono text-[10px] uppercase tracking-[0.22em] text-copper transition hover:translate-x-1"
                  >
                    Commission →
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
