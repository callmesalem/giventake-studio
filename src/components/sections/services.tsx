const services = [
  { mark: "I", title: "Website Development", give: "Your story", take: "A site that converts",
    body: "Marketing sites built to be fast, accessible, and edited without calling a developer." },
  { mark: "II", title: "Web Applications", give: "Your operation", take: "Software that fits",
    body: "Custom software shaped to how your business actually works, not another off-the-shelf compromise." },
  { mark: "III", title: "AI Integrations", give: "Your data", take: "Practical AI",
    body: "AI woven into your product and workflows. No hype: chat, generation, extraction, decisions." },
  { mark: "IV", title: "Business Automation", give: "Manual work", take: "Autopilot",
    body: "Connect the tools you already pay for. Sales, ops, billing, and reporting on autopilot." },
  { mark: "V", title: "Internal Tools", give: "Spreadsheets", take: "Real dashboards",
    body: "Dashboards, admin panels, and portals your team will actually use every day." },
  { mark: "VI", title: "MVP Development", give: "A rough idea", take: "A shippable v1",
    body: "A real, working product in front of customers in weeks. Built to grow, not to be thrown away." },
  { mark: "VII", title: "Ongoing Development", give: "A roadmap", take: "A senior team on tap",
    body: "A team retained by the month. Ship continuously, without the overhead of a payroll." },
];

export function Services() {
  return (
    <section id="services" className="border-b border-ink/80">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mb-14 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-copper">
              № 04 / The Services
            </span>
            <h2 className="mt-6 font-display text-4xl font-light leading-[1] tracking-[-0.02em] text-ink md:text-6xl">
              Everything you'd staff
              <br />
              an <span className="italic">engineering team</span> for.
            </h2>
          </div>
          <p className="col-span-12 max-w-sm font-display text-xl italic leading-snug text-ink/70 lg:col-span-4 lg:col-start-9 lg:self-end">
            Pick a project or engage us continuously. One integrated team, one point of contact.
          </p>
        </div>

        {/* Ledger table of services */}
        <div className="border border-ink">
          <div className="hidden grid-cols-12 gap-6 border-b border-ink bg-ink px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-paper md:grid">
            <span className="col-span-1">№</span>
            <span className="col-span-4">Service</span>
            <span className="col-span-4">You give</span>
            <span className="col-span-3">You take</span>
          </div>
          <ul>
            {services.map((s, i) => (
              <li
                key={s.title}
                className={`group grid grid-cols-12 items-baseline gap-6 bg-paper px-6 py-5 transition hover:bg-paper-2/60 ${
                  i < services.length - 1 ? "border-b border-ink/20" : ""
                }`}
              >
                <span className="col-span-2 font-display text-2xl italic text-copper md:col-span-1">{s.mark}</span>
                <div className="col-span-10 md:col-span-4">
                  <h3 className="font-display text-2xl font-normal leading-tight text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-1 max-w-md text-[13.5px] leading-relaxed text-ink/60 md:hidden">
                    {s.body}
                  </p>
                  <p className="mt-1 hidden max-w-md text-[13.5px] leading-relaxed text-ink/60 md:block">
                    {s.body}
                  </p>
                </div>
                <div className="col-span-6 mt-3 flex items-baseline gap-2 font-display text-lg italic text-ink/80 md:col-span-4 md:mt-0">
                  <span>{s.give}</span>
                </div>
                <div className="col-span-6 mt-3 flex items-baseline gap-3 md:col-span-3 md:mt-0">
                  <span className="font-mono text-sm text-copper transition group-hover:translate-x-1">→</span>
                  <span className="font-display text-lg text-ink">{s.take}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
