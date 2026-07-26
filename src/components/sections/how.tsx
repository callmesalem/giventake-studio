import { MessageSquare, PenTool, Rocket } from "lucide-react";

const steps = [
  {
    icon: MessageSquare,
    number: "01",
    title: "Tell us your idea",
    body: "A 30-minute strategy call. We map the problem, the users, and what to build first.",
  },
  {
    icon: PenTool,
    number: "02",
    title: "We design & build",
    body: "Weekly demos, tight feedback loops. You watch it come together — no black box.",
  },
  {
    icon: Rocket,
    number: "03",
    title: "Launch & grow",
    body: "We ship it, monitor it, and keep improving. Iterate as fast as your business moves.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">How it works</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            From idea to live product in three steps.
          </h2>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />
          <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
            {steps.map(({ icon: Icon, number, title, body }) => (
              <li key={number} className="relative">
                <div className="flex flex-col items-start">
                  <div className="relative grid h-[72px] w-[72px] place-items-center rounded-2xl border border-border/70 bg-card">
                    <Icon className="h-6 w-6 text-brand" strokeWidth={1.6} />
                    <span className="absolute -right-2 -top-2 rounded-full border border-border/70 bg-background px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                      {number}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
