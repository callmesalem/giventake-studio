import { Reveal } from "@/components/reveal";
import { IconPlan, IconCode, IconTest, IconReview, IconDeploy } from "@/components/marks";

const workflow = [
  {
    step: "01",
    title: "Plan",
    label: "Human-led",
    labelStyle: "bg-ink text-white",
    body: "We start with your business, your users, and the problem. I write a short scope doc and a plan. No code is written until you sign off.",
    checkpoint: "You approve the scope before we start building.",
    Icon: IconPlan,
  },
  {
    step: "02",
    title: "Code",
    label: "AI agents",
    labelStyle: "bg-violet text-white",
    body: "AI coding agents generate the first pass: components, APIs, and migrations. I steer them, fix errors, and keep the architecture coherent.",
    checkpoint: "I review every generated file before it moves on.",
    Icon: IconCode,
  },
  {
    step: "03",
    title: "Test",
    label: "AI + human",
    labelStyle: "bg-violet-soft text-violet",
    body: "Automated tests run alongside the code. I add edge cases, check the critical paths, and make sure the feature actually works.",
    checkpoint: "Tests must pass before we move to review.",
    Icon: IconTest,
  },
  {
    step: "04",
    title: "Review",
    label: "Human checkpoint",
    labelStyle: "bg-ink text-white",
    body: "This is the gate. I read the code, tighten the UX, and run security checks. AI moves fast; I decide what is ready to ship.",
    checkpoint: "Nothing ships without my manual review.",
    Icon: IconReview,
  },
  {
    step: "05",
    title: "Deploy",
    label: "Human-approved",
    labelStyle: "bg-ink text-white",
    body: "We push to a staging environment so you can use it. Once you sign off, it goes live. I handle hosting, domains, and monitoring.",
    checkpoint: "You sign off before the final launch.",
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
            Agentic speed with human checkpoints.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-ink">
            AI coding agents do the heavy lifting. I stay in the loop at every step that matters, so
            you get speed without giving up judgment.
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

                  <span
                    className={`mt-3 w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${w.labelStyle}`}
                  >
                    {w.label}
                  </span>

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
          <p className="text-[14px] leading-relaxed text-muted-ink">
            The goal is simple: move faster than a traditional team, but keep every important
            decision in human hands. The AI helps me code; I own the result.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
