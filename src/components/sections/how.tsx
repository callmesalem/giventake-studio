const steps = [
  {
    n: "1",
    title: "Tell us your idea",
    body: "A 30-minute call. We ask about the business, the users, and what's actually broken. You leave with a clear next step, not a sales pitch.",
  },
  {
    n: "2",
    title: "We design and build with AI",
    body: "I use AI coding agents and modern frameworks to move fast. You see progress every week. Real screens, real data, real code. If something isn't landing, we catch it early.",
  },
  {
    n: "3",
    title: "Launch and iterate",
    body: "We push it live, watch how it's used, and keep improving. Most projects keep shipping after launch, on a monthly retainer.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-hairline">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">How it works</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            From idea to live product in three steps.
          </h2>
        </div>

        <div className="relative grid gap-6 md:grid-cols-3">
          {/* connector line */}
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-hairline md:block" />
          {steps.map((s) => (
            <article
              key={s.n}
              className="relative rounded-2xl border border-hairline bg-white p-7 shadow-soft"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-paper text-[16px] font-semibold text-ink">
                {s.n}
              </div>
              <h3 className="mt-6 text-[22px] font-semibold tracking-tight text-ink">
                {s.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
