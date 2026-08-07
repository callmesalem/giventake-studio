import { Reveal } from "@/components/reveal";
import { IconArrowRight } from "@/components/marks";

/**
 * Real work only.
 *
 * The previous version of this file carried invented clients and invented
 * metrics under a heading that claimed they were not mockups. Everything here
 * is checkable: the scale figures were counted from the codebases, and the
 * status label says plainly whether a thing is running in production or simply
 * built. Nothing claims a user, a dollar, or a percentage that cannot be shown.
 */

type Status = "live" | "built";

interface Study {
  client: string;
  title: string;
  status: Status;
  /** Where it runs, when that is a public address someone can open. */
  href?: string;
  problem: string;
  built: string;
  /** Counted from source, not estimated. */
  facts: { label: string; value: string }[];
  /** What the AI did, and what stayed in human hands. */
  agentic: string;
  tags: string[];
  image?: string;
  alt?: string;
}

const studies: Study[] = [
  {
    client: "Public adjusting firm",
    title: "The system a claims firm runs on",
    status: "live",
    href: "https://atccrm.space",
    problem:
      "A public adjuster's day was spread across a dozen tools that did not talk to each other. The claim lived in one place, the photos in another, carrier emails in a third, the estimate in a PDF, and the invoice in a spreadsheet. The numbers that decide whether the firm gets paid were the ones most likely to drift.",
    built:
      "One system that runs the whole firm. Claims move through a pipeline, AI reads carrier estimates and pulls the figures off them, email and texting attach to the claim, and the books track expenses, receipts and mileage. It went live and has been shipping new work every month since.",
    // Counted 2026-07-31: 99 .sql files in supabase/migrations (the 100th entry
    // is the _archive directory), 73 deployable edge functions (_shared is a
    // library, not a function), 38 page components. Do not round these up.
    facts: [
      { label: "Database migrations", value: "99" },
      { label: "Backend functions", value: "73" },
      { label: "Screens", value: "38" },
    ],
    agentic:
      "AI wrote a large share of the implementation. I owned the data model, the money rules, and the security review. The fee calculation lives in one place so no two screens can disagree, and the assistant cannot send an email, change a claim's status, or alter a fee percentage without a human clicking approve.",
    tags: ["Live product", "AI documents", "Postgres", "Payments"],
  },
  {
    client: "Insurance claims tooling",
    title: "AI that reads a policy and refuses to invent",
    status: "built",
    problem:
      "Reading a property policy against a specific claim is slow, and being wrong is expensive. The answer is buried across declarations, exclusions, conditions and endorsements, and it shifts depending on the facts of the claim. Most people skim it or pay a lawyer.",
    built:
      "Upload the policy, enter the claim facts, get a structured analysis with a citation on every finding. Five stages: pull the text, classify the sections, extract typed clauses, match them to the claim, then write the memo. Roughly half of real policies arrive as scans, so when a page comes back with almost no readable text it reroutes through OCR automatically.",
    facts: [
      { label: "Analysis stages", value: "5" },
      { label: "Coverage postures", value: "4" },
      { label: "Every finding", value: "Cited" },
    ],
    agentic:
      "The interesting engineering is in what it does when unsure. Each clause lands in one of four honest postures, including one for arguments the insurer could make against you. The model is instructed to use only the supplied document and never invent policy language, every finding carries its page number, and each run logs its own token cost.",
    tags: ["AI pipeline", "OCR", "Next.js", "Citations"],
  },
  {
    client: "Cleveland deli",
    title: "A halal deli sold like the destination it is",
    status: "built",
    problem:
      "A genuinely good kitchen was invisible online. Ohio City Subs slices corned beef fresh daily and serves until 3AM out of a gas station on Lorain Ave. The people who find it rave about it. Almost nobody finds it, and a deli inside a gas station is a hard sell to anyone who has not tasted the food.",
    built:
      "A single page that leads with the two things regulars actually talk about: halal corned beef sliced fresh, and a kitchen open until 3AM. The full menu is on the page, with catering tiers and the lead time stated up front so nobody has to call to find out. The deli runs 10AM to 3AM while the station runs around the clock, so the page shows both rather than flattening them into one wrong answer.",
    facts: [
      { label: "Page weight", value: "One file" },
      { label: "Menu items", value: "26" },
      { label: "Dependencies", value: "None" },
    ],
    agentic:
      "Built and styled with AI assistance, then finished by hand where it mattered. I replaced every stock photo with the owner's own footage, corrected a map embed that pointed nowhere, reconciled a price that disagreed with the menu, and marked the page up as a restaurant so it can earn a local search result.",
    tags: ["Website", "Local SEO", "No framework"],
    image: "/case-ohio-city-subs.png",
    alt: "Ohio City Subs single page site showing the halal corned beef headline, hours and ordering calls to action.",
  },
];

function StatusBadge({ status }: { status: Status }) {
  const live = status === "live";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        live
          ? "border-violet/30 bg-violet-soft text-violet"
          : "border-hairline bg-secondary text-muted-ink"
      }`}
    >
      {live && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-violet pulse-dot" />
        </span>
      )}
      {live ? "Live in production" : "Built, not yet public"}
    </span>
  );
}

export function CaseStudies() {
  return (
    <div className="mt-20">
      <div className="mb-10 max-w-2xl">
        <Reveal>
          <p className="text-[13px] font-medium text-violet">Case studies</p>
          <h3 className="mt-3 font-display text-3xl font-medium tracking-[-0.03em] text-ink md:text-4xl">
            Real systems, and what is actually true about them.
          </h3>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-ink">
            Every figure below was counted from the codebase. Where something is running in
            production it says so, and where it is built but not yet public it says that too. You
            should expect the same honesty about your project.
          </p>
        </Reveal>
      </div>

      <div className="space-y-10">
        {studies.map((s, i) => (
          <Reveal key={s.title} delay={i * 100}>
            <article className="card-lift overflow-hidden rounded-2xl border border-hairline bg-white shadow-soft">
              <div className={s.image ? "grid lg:grid-cols-[1.1fr_1.4fr]" : ""}>
                {/* copy side */}
                <div
                  className={`flex flex-col justify-between p-8 ${
                    s.image ? "border-b border-hairline lg:border-b-0 lg:border-r" : ""
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[12px] font-semibold uppercase tracking-wider text-violet">
                        {s.client}
                      </span>
                      <StatusBadge status={s.status} />
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
                          What I built
                        </p>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{s.built}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-3">
                      {s.facts.map((f) => (
                        <div key={f.label} className="text-center">
                          <p className="text-[18px] font-semibold text-ink">{f.value}</p>
                          <p className="mt-0.5 text-[11px] font-medium text-muted-ink">{f.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
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

                  <div className="mt-8">
                    <p className="text-[14px] leading-relaxed text-muted-ink">
                      <span className="font-semibold text-ink">Agentic delivery:</span> {s.agentic}
                    </p>
                    <div className="mt-5 flex flex-wrap items-center gap-5">
                      <a
                        href="#contact"
                        className="btn-icon-nudge inline-flex items-center gap-1.5 text-[13px] font-medium text-violet transition hover:gap-2.5"
                      >
                        Discuss a similar project
                        <IconArrowRight className="h-4 w-4" />
                      </a>
                      {s.href && (
                        <a
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] font-medium text-muted-ink underline underline-offset-4 transition hover:text-ink"
                        >
                          Visit the live system
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* screenshot side, only where a real one exists */}
                {s.image && (
                  <div className="bg-secondary/50 p-6 lg:p-8">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
                        The shipped page
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
                )}
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
