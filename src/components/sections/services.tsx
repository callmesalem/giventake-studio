import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/reveal";
import { offers } from "@/lib/offers";
import {
  IconBot,
  IconGlobe,
  IconApp,
  IconSpark,
  IconLoop,
  IconGrid,
  IconRocket,
  IconInfinity,
  IconArrowRight,
} from "@/components/marks";

const services = [
  {
    Icon: IconBot,
    title: "Agentic systems & AI workflows",
    body: "Custom AI agents that handle intake, research, drafting, or routing. Built to plug into your existing tools, not replace your team.",
  },
  {
    Icon: IconGlobe,
    title: "Website development",
    body: "Marketing sites that load fast, rank, and can be edited by someone on your team without opening a support ticket.",
  },
  {
    Icon: IconApp,
    title: "Web applications",
    body: "Custom software for the parts of your business that don't fit into Notion, Airtable, or an off-the-shelf SaaS.",
  },
  {
    Icon: IconSpark,
    title: "AI integrations",
    body: "LLM-powered features wired into your product: summarization, extraction, search, and routing. We skip the demo and ship the workflow.",
  },
  {
    Icon: IconLoop,
    title: "Business automation",
    body: "The tools you already pay for, connected. Leads land in your CRM, invoices go out, reports write themselves.",
  },
  {
    Icon: IconGrid,
    title: "Internal tools",
    body: "Dashboards, admin panels, and ops tools your team opens every morning instead of another spreadsheet.",
  },
  {
    Icon: IconRocket,
    title: "MVP development",
    body: "A working product in front of real users in six to ten weeks. Built to be extended, not thrown away.",
  },
  {
    Icon: IconInfinity,
    title: "Ongoing development",
    body: "A retained team by the month. Continuous shipping without the overhead of running a payroll.",
  },
];

export function Services() {
  return (
    <section id="services" className="border-b border-hairline bg-secondary/50">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <Reveal className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">Services</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            Everything you'd staff an engineering team for.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-ink">
            Pick a project or engage us continuously. One integrated team, one point of contact.
          </p>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <Reveal key={s.title} delay={i * 60}>
              <article className="card-lift group h-full rounded-2xl border border-hairline bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-ink transition group-hover:bg-violet-soft group-hover:text-violet">
                  <s.Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-[18px] font-semibold tracking-tight text-ink">
                  {s.title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted-ink">{s.body}</p>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Priced starting points — one page per offer, each with a real number,
            a timeline, and an explicit exclusion list. See docs/business/08 §4. */}
        <Reveal delay={120}>
          <div className="mt-16">
            <div className="mb-7 max-w-2xl">
              <h3 className="font-display text-2xl font-medium tracking-[-0.02em] text-ink md:text-3xl">
                Fixed-price starting points.
              </h3>
              <p className="mt-3 text-[16px] leading-relaxed text-muted-ink">
                Every project is scoped before it's quoted, but these are the shapes we build most
                often — with what's included, what isn't, and where the price starts.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => (
                <Link
                  key={o.slug}
                  to="/services/$slug"
                  params={{ slug: o.slug }}
                  className="card-lift group flex h-full flex-col rounded-2xl border border-hairline bg-white p-5 shadow-soft transition hover:border-ink"
                >
                  <p className="text-[16px] font-semibold leading-snug tracking-tight text-ink">
                    {o.title}
                  </p>
                  <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-muted-ink">
                    {o.tagline}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3.5">
                    <span className="text-[14px] font-semibold text-ink">{o.priceFrom}</span>
                    <span className="text-[12px] text-muted-ink">{o.timeline}</span>
                  </div>
                  <span className="btn-icon-nudge mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-violet group-hover:gap-2.5">
                    See what's included
                    <IconArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
