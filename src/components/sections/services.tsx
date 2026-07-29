import { IconGlobe, IconApp, IconSpark, IconLoop, IconGrid, IconRocket, IconInfinity } from "@/components/marks";

const services = [
  { Icon: IconGlobe, title: "Website development", body: "Marketing sites that load fast, rank, and can be edited by someone on your team without opening a support ticket." },
  { Icon: IconApp, title: "Web applications", body: "Custom software for the parts of your business that don't fit into Notion, Airtable, or an off-the-shelf SaaS." },
  { Icon: IconSpark, title: "AI integrations", body: "The useful parts of AI wired into your product: drafting, extraction, search, and routing. We skip the hype and ship the workflows." },
  { Icon: IconLoop, title: "Business automation", body: "The tools you already pay for, connected. Leads land in your CRM, invoices go out, reports write themselves." },
  { Icon: IconGrid, title: "Internal tools", body: "Dashboards, admin panels, and ops tools your team opens every morning instead of another spreadsheet." },
  { Icon: IconRocket, title: "MVP development", body: "A working product in front of real users in six to ten weeks. Built to be extended, not thrown away." },
  { Icon: IconInfinity, title: "Ongoing development", body: "A retained team by the month. Continuous shipping without the overhead of running a payroll." },
];

export function Services() {
  return (
    <section id="services" className="border-b border-hairline bg-secondary/50">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">Services</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            Everything you'd staff an engineering team for.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-ink">
            Pick a project or engage us continuously. One integrated team, one point of contact.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <article
              key={s.title}
              className="group rounded-2xl border border-hairline bg-white p-6 transition hover:shadow-soft"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-ink transition group-hover:bg-violet-soft group-hover:text-violet">
                <s.Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-[18px] font-semibold tracking-tight text-ink">
                {s.title}
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted-ink">{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
