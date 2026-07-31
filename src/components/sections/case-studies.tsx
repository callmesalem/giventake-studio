import { Reveal } from "@/components/reveal";
import { IconArrowRight } from "@/components/marks";
import intakeAsset from "@/assets/case-intake.png.asset.json";
import bookingAsset from "@/assets/case-booking.png.asset.json";
import dashboardAsset from "@/assets/case-dashboard.png.asset.json";

/**
 * Illustrative builds — NOT client case studies.
 *
 * The studio is new and has no delivered client work to publish yet. Everything
 * in this section is an example of what we build and how we'd approach it, and
 * it is labelled as such on every card. Do not add client names, outcome
 * metrics, or past-tense delivery claims here until there is a real engagement
 * behind them with written permission to publish.
 */
const builds = [
  {
    kind: "Example build",
    title: "From raw inbox to routed leads",
    problem:
      "Enquiries arrive as unstructured email. Someone has to read every one, guess the intent, and forward it by hand. Response times slip into days and good leads go cold.",
    system:
      "An AI agent reads and tags each enquiry, routes high-intent leads to the right Slack channel, and files the rest. The team sees a structured summary instead of a raw inbox.",
    capabilities: [
      "Parses email and web-form submissions",
      "Classifies intent and urgency",
      "Routes to the right channel or owner",
      "Posts a structured summary, not a forward",
    ],
    approach:
      "We'd build a custom agent to parse submissions, classify intent, and post structured summaries. The routing logic, the prompts, and the edge cases stay in human hands — that part is not delegated to the model.",
    tags: ["AI agent", "Email parsing", "Slack"],
    image: intakeAsset.url,
    alt: "Concept render of an AI lead intake router, showing enquiries grouped by intent and routed to Slack channels.",
  },
  {
    kind: "Example build",
    title: "Booking and payment without the back-and-forth",
    problem:
      "Customers book by phone or DM. Availability goes out by hand, deposits get chased, and the diary lives on paper. No-shows cost real money and nobody can see the schedule at a glance.",
    system:
      "Customers pick a slot, pay, and reschedule themselves. The owner sees everything in one place and collects payment before the appointment starts.",
    capabilities: [
      "Self-service slot booking and rescheduling",
      "Deposit or full payment at time of booking",
      "Automated reminders and cancellation rules",
      "One shared view of the schedule",
    ],
    approach:
      "The UI, booking logic, and payment integration would be built with AI-assisted coding. We review every API route by hand, add cancellation guardrails, and test the payment flow end to end before anything goes live.",
    tags: ["Scheduling", "Payments", "Client portal"],
    image: bookingAsset.url,
    alt: "Concept render of a self-service booking system, showing a weekly calendar of appointment slots and a payment checkout step.",
  },
  {
    kind: "Example build",
    title: "One dashboard replacing five spreadsheets",
    problem:
      "Job status, invoices, and client notes live across several shared spreadsheets. Nobody trusts the numbers, and reconciling them by hand eats an evening a week.",
    system:
      "A single dashboard shows jobs, invoices, status, and revenue in real time, reading from one source of truth instead of five.",
    capabilities: [
      "One data model behind every view",
      "Live job, invoice, and status tracking",
      "Role-based access for staff and owner",
      "Calculated fields verified against source data",
    ],
    approach:
      "We'd generate the data model, dashboard components, and chart logic with AI agents, then tighten the schema, write the auth rules by hand, and verify every calculated field against the real numbers before handover.",
    tags: ["Dashboard", "Postgres", "Auth"],
    image: dashboardAsset.url,
    alt: "Concept render of an internal business dashboard, showing active jobs, invoiced revenue, pending reviews, and a weekly revenue bar chart.",
  },
];

export function CaseStudies() {
  return (
    <div className="mt-20">
      <div className="mb-10 max-w-2xl">
        <Reveal>
          <p className="text-[13px] font-medium text-violet">Example builds</p>
          <h3 className="mt-3 font-display text-3xl font-medium tracking-[-0.03em] text-ink md:text-4xl">
            What we build, honestly labelled.
          </h3>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-ink">
            These are illustrative builds, not client case studies. We&rsquo;re a new studio, so
            rather than dress up example work as delivered projects, here is the kind of system we
            build, the problem it solves, and exactly which parts stay in human hands.
          </p>
        </Reveal>
      </div>

      <div className="space-y-10">
        {builds.map((s, i) => (
          <Reveal key={s.title} delay={i * 100}>
            <article className="card-lift overflow-hidden rounded-2xl border border-hairline bg-white shadow-soft">
              <div className="grid lg:grid-cols-[1.1fr_1.4fr]">
                {/* copy side */}
                <div className="flex flex-col justify-between border-b border-hairline p-8 lg:border-b-0 lg:border-r">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-violet/25 bg-violet-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet">
                        {s.kind}
                      </span>
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
                          The problem
                        </p>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{s.problem}</p>
                      </div>
                      <div className="rounded-xl border border-hairline bg-violet-soft p-4">
                        <p className="text-[12px] font-semibold uppercase tracking-wider text-violet">
                          The system
                        </p>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{s.system}</p>
                      </div>
                    </div>

                    <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                      {s.capabilities.map((c) => (
                        <li
                          key={c}
                          className="flex items-start gap-2.5 text-[14px] leading-snug text-ink/85"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8">
                    <p className="text-[14px] leading-relaxed text-muted-ink">
                      <span className="font-semibold text-ink">How we&rsquo;d build it:</span>{" "}
                      {s.approach}
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

                {/* concept render side */}
                <div className="bg-secondary/50 p-6 lg:p-8">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
                      Concept render
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-ink">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-violet pulse-dot" />
                      </span>
                      Illustrative, not a client screenshot
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
