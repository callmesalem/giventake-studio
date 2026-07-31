import { Reveal } from "@/components/reveal";
import { IconArrowRight } from "@/components/marks";
import intakeAsset from "@/assets/case-intake.png.asset.json";
import bookingAsset from "@/assets/case-booking.png.asset.json";
import dashboardAsset from "@/assets/case-dashboard.png.asset.json";

const studies = [
  {
    client: "Consultancy",
    title: "From raw inbox to routed leads",
    before:
      "40+ raw enquiry emails a week. Someone had to read every one, guess the intent, and forward it manually. Response time was usually one to two days, and good leads went cold.",
    after:
      "An AI agent reads and tags each enquiry, routes high-intent leads to the right Slack channel, and files the rest. The team now replies to serious prospects in under two hours.",
    metrics: [
      { label: "First response", before: "1–2 days", after: "<2 hours" },
      { label: "Leads auto-routed", before: "0%", after: "89%" },
      { label: "Manual sorting", before: "~6 hrs/week", after: "~30 min/week" },
    ],
    agentic:
      "I built a custom AI agent that parses email and form submissions, classifies intent, and posts structured summaries to the right channel. I wrote the routing logic, review the edge cases, and own the prompts.",
    tags: ["AI agent", "Email parsing", "Slack"],
    image: intakeAsset.url,
    alt: "AI lead intake router dashboard showing enquiries categorized by intent and routed to Slack channels.",
  },
  {
    client: "Service business",
    title: "Booking and payment without the back-and-forth",
    before:
      "Customers booked by phone or DM. The owner sent availability by hand, chased deposits, and manually updated a paper diary. No-shows cost real money.",
    after:
      "Customers pick a slot, pay, and reschedule themselves. The owner sees everything in one place and gets paid before the appointment starts.",
    metrics: [
      { label: "Bookings handled", before: "All manual", after: "Self-service" },
      { label: "No-shows", before: "~18%", after: "~4%" },
      { label: "Admin time", before: "~10 hrs/week", after: "~2 hrs/week" },
    ],
    agentic:
      "The UI, booking logic, and Stripe integration were built with AI-assisted coding. I reviewed every API route, added cancellation guardrails, and tested the payment flow end to end before launch.",
    tags: ["Scheduling", "Payments", "Client portal"],
    image: bookingAsset.url,
    alt: "Self-service booking system showing a weekly calendar with appointment slots and Stripe payment checkout.",
  },
  {
    client: "Trades company",
    title: "One dashboard replacing five spreadsheets",
    before:
      "Job status, invoices, and client notes lived across five shared spreadsheets. Nobody trusted the numbers, and the owner spent Friday evenings reconciling by hand.",
    after:
      "A single dashboard shows jobs, invoices, status, and weekly revenue in real time. The owner knows the state of the business in ten seconds.",
    metrics: [
      { label: "Data sources", before: "5 spreadsheets", after: "1 dashboard" },
      { label: "Weekly reconciliation", before: "~3 hrs", after: "~15 min" },
      { label: "Invoicing lag", before: "~5 days", after: "Same day" },
    ],
    agentic:
      "I generated the data model, dashboard components, and chart logic with AI agents, then tightened the schema, wrote the auth rules, and verified every calculated field against the real business numbers.",
    tags: ["Dashboard", "Postgres", "Auth"],
    image: dashboardAsset.url,
    alt: "Internal business dashboard showing active jobs, invoiced revenue, pending reviews, and a weekly revenue bar chart.",
  },
];

export function CaseStudies() {
  return (
    <div className="mt-20">
      <div className="mb-10 max-w-2xl">
        <Reveal>
          <p className="text-[13px] font-medium text-violet">Case studies</p>
          <h3 className="mt-3 font-display text-3xl font-medium tracking-[-0.03em] text-ink md:text-4xl">
            Agentic workflows, real outcomes.
          </h3>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-ink">
            These are not mockups. Each block shows the actual workflow output, the before/after
            result, and the part I kept in human hands.
          </p>
        </Reveal>
      </div>

      <div className="space-y-10">
        {studies.map((s, i) => (
          <Reveal key={s.title} delay={i * 100}>
            <article className="card-lift overflow-hidden rounded-2xl border border-hairline bg-white shadow-soft">
              <div className="grid lg:grid-cols-[1.1fr_1.4fr]">
                {/* copy side */}
                <div className="flex flex-col justify-between border-b border-hairline p-8 lg:border-b-0 lg:border-r">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[12px] font-semibold uppercase tracking-wider text-violet">
                        {s.client}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-hairline" />
                      <div className="flex flex-wrap gap-2">
                        {s.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-hairline bg-secondary px-2.5 py-1 text-[11px] font-medium text-ink"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <h4 className="mt-4 font-display text-2xl font-medium tracking-[-0.02em] text-ink md:text-3xl">
                      {s.title}
                    </h4>

                    <div className="mt-6 grid gap-5">
                      <div className="rounded-xl border border-hairline bg-paper p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
                          Before
                        </p>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{s.before}</p>
                      </div>
                      <div className="rounded-xl border border-hairline bg-violet-soft p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-wider text-violet">
                          After
                        </p>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{s.after}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-3">
                      {s.metrics.map((m) => (
                        <div key={m.label} className="text-center">
                          <p className="text-[11px] font-medium text-muted-ink">{m.label}</p>
                          <p className="mt-1 text-[12px] text-muted-ink line-through">{m.before}</p>
                          <p className="text-[16px] font-semibold text-ink">{m.after}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="text-[14px] leading-relaxed text-muted-ink">
                      <span className="font-semibold text-ink">Agentic delivery:</span> {s.agentic}
                    </p>
                    <a
                      href="#contact"
                      className="btn-icon-nudge mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-violet transition hover:gap-2.5"
                    >
                      Discuss a similar project
                      <IconArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* screenshot side */}
                <div className="bg-secondary/50 p-6 lg:p-8">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
                      Workflow output
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-ink">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-violet pulse-dot" />
                      </span>
                      AI + human review
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-hairline bg-white shadow-soft">
                    <img
                      src={s.image}
                      alt={s.alt}
                      width={1280}
                      height={800}
                      loading="lazy"
                      className="block w-full"
                    />
                  </div>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
