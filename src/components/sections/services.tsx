import {
  Globe,
  AppWindow,
  Sparkles,
  Workflow,
  Wrench,
  Rocket,
  Infinity as InfinityIcon,
  ArrowUpRight,
} from "lucide-react";

const services = [
  {
    icon: Globe,
    title: "Website Development",
    body: "Marketing sites that convert. Fast, accessible, and built to be edited without calling a developer.",
  },
  {
    icon: AppWindow,
    title: "Web Applications",
    body: "Custom software tailored to how your business actually operates, not another off-the-shelf compromise.",
  },
  {
    icon: Sparkles,
    title: "AI Integrations",
    body: "Practical AI woven into your product and workflows. No hype, real outcomes: chat, generation, extraction, decisions.",
  },
  {
    icon: Workflow,
    title: "Business Automation",
    body: "Replace manual work between your tools. Sales, ops, billing, and reporting on autopilot.",
  },
  {
    icon: Wrench,
    title: "Internal Tools",
    body: "Dashboards, admin panels, and client portals your team will actually use every day.",
  },
  {
    icon: Rocket,
    title: "MVP Development",
    body: "Get a real, shippable product in front of customers in weeks. Built to grow, not to be thrown away.",
  },
  {
    icon: InfinityIcon,
    title: "Ongoing Development",
    body: "A senior team retained by the month. Ship continuously, without the overhead of a payroll.",
    wide: true,
  },
];

export function Services() {
  return (
    <section id="services" className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">Services</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Everything you'd staff an engineering team for.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Pick a project or engage us continuously. One integrated team, one point of contact.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 md:grid-cols-3">
          {services.map(({ icon: Icon, title, body, wide }) => (
            <article
              key={title}
              className={`group relative flex flex-col justify-between gap-8 bg-card p-7 transition hover:bg-muted/40 ${
                wide ? "md:col-span-3" : ""
              }`}
            >
              <div>
                <div className="mb-6 grid h-10 w-10 place-items-center rounded-lg border border-border/70 bg-background">
                  <Icon className="h-5 w-5 text-brand" strokeWidth={1.6} />
                </div>
                <h3 className="text-base font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
