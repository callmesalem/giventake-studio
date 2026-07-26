import { Globe, Bot, Workflow, LayoutDashboard, Users, Wrench } from "lucide-react";

const items = [
  { icon: Globe, label: "Websites" },
  { icon: Bot, label: "AI Apps" },
  { icon: Workflow, label: "Automation" },
  { icon: LayoutDashboard, label: "Dashboards" },
  { icon: Users, label: "Client Portals" },
  { icon: Wrench, label: "Internal Tools" },
];

export function TrustedPartner() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">
            A trusted partner
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            You focus on your business.
            <br />
            We'll build the technology.
          </h2>
          <p className="mt-4 text-muted-foreground">
            One team for everything you'd normally hire six freelancers to do.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 md:grid-cols-6">
          {items.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="group flex flex-col items-center justify-center gap-2 bg-background px-4 py-8 transition hover:bg-muted/60"
            >
              <Icon className="h-5 w-5 text-muted-foreground transition group-hover:text-brand" strokeWidth={1.6} />
              <span className="text-xs font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
