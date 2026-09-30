import { Reveal } from "@/components/reveal";
import { IconPlan, IconCode, IconTest, IconReview, IconDeploy } from "@/components/marks";

const workflow = [
  {
    step: "01",
    title: "Call",
    body: "One conversation about what you sell, who buys it, and what's eating your week. We listen, you talk.",
    checkpoint: "You tell us the problem in plain language.",
    Icon: IconPlan,
  },
  {
    step: "02",
    title: "Plan",
    body: "Within a week you get a page-by-page plan: what we're building, what it costs, and when it's live.",
    checkpoint: "You approve the plan before we build anything.",
    Icon: IconCode,
  },
  {
    step: "03",
    title: "Build",
    body: "We build it in weeks, not quarters. You see real pages as they go up, not a mockup a month later.",
    checkpoint: "You see progress every week.",
    Icon: IconTest,
  },
  {
    step: "04",
    title: "Launch",
    body: "We handle the domain, the security certificate, and your analytics setup, then test everything on real phones.",
    checkpoint: "You get the speed numbers before it goes live.",
    Icon: IconReview,
  },
  {
    step: "05",
    title: "Report",
    body: "Every quarter, a plain-English report: where your visitors came from, what they did, and the one fix we'd make next.",
    checkpoint: "You always know what the site is doing for you.",
    Icon: IconDeploy,
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-hairline">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <Reveal className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">How we work</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            Tell us what&rsquo;s eating your week.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-ink">
            No 40-page proposals, no discovery theater. Five steps, and the last one never ends.
          </p>
        </Reveal>

        {/* desktop: horizontal timeline; mobile: vertical stack */}
        <div className="relative">
          {/* connector line */}
          <div className="absolute top-[64px] left-[11%] right-[11%] hidden h-px bg-hairline lg:block" />

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {workflow.map((w, i) => (
              <Reveal key={w.step} delay={i * 70}>
                <article className="card-lift relative flex h-full flex-col rounded-2xl border border-hairline bg-white p-6 shadow-soft">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-paper text-ink">
                      <w.Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums text-muted-ink">
                      {w.step}
                    </span>
                  </div>

                  <h3 className="mt-6 text-[20px] font-semibold tracking-tight text-ink">
                    {w.title}
                  </h3>

                  <p className="mt-4 flex-1 text-[14.5px] leading-relaxed text-muted-ink">
                    {w.body}
                  </p>

                  <div className="mt-5 border-t border-hairline pt-4">
                    <p className="text-[13px] leading-[1.5] text-ink">
                      <span className="font-semibold text-violet">Checkpoint:</span> {w.checkpoint}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={100} className="mt-10">
          <p className="max-w-2xl text-[14px] leading-relaxed text-muted-ink">
            We use AI tooling to build faster, and a human reviews everything before it ships.
            That&rsquo;s the whole story. The part that matters to you is the report in step five.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
