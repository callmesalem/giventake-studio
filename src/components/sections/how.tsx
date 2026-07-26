const steps = [
  {
    mark: "I",
    label: "Tell",
    title: "Tell us your idea",
    body: "A 30-minute strategy call. We map the problem, the users, and what to build first.",
  },
  {
    mark: "II",
    label: "Make",
    title: "We design & build",
    body: "Weekly demos, tight feedback loops. You watch it come together, with no black box.",
  },
  {
    mark: "III",
    label: "Ship",
    title: "Launch & grow",
    body: "We ship it, monitor it, and keep improving. Iterate as fast as your business moves.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-ink/80 bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mb-16 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ochre">
              № 05 / The Process
            </span>
            <h2 className="mt-6 font-display text-4xl font-light leading-[1] tracking-[-0.02em] text-paper md:text-6xl">
              From idea to live product
              <br />
              in <span className="italic">three movements.</span>
            </h2>
          </div>
        </div>

        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((s, i) => (
            <li key={s.mark} className="relative border-t border-paper/40 pt-6">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-6xl font-light italic text-copper">{s.mark}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/50">
                  Movement {i + 1}
                </span>
              </div>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-ochre">
                {s.label}
              </p>
              <h3 className="mt-2 font-display text-3xl font-normal leading-tight text-paper">
                {s.title}
              </h3>
              <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-paper/70">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
