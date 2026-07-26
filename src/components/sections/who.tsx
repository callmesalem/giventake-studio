const cards = [
  {
    mark: "A",
    title: "Small Businesses",
    body: "Modernize the way you operate. Replace the patchwork of tools you're paying for with one system that fits the way you actually work.",
    give: "Your workflow",
    take: "A working system",
  },
  {
    mark: "B",
    title: "Founders",
    body: "You have the idea and the customers. We become the technical co-founder you'd otherwise spend a year trying to find.",
    give: "The idea",
    take: "A shipped product",
  },
  {
    mark: "C",
    title: "Growing Companies",
    body: "Ship product without a hiring cycle. A senior team that plugs in when you need it, and steps back when you don't.",
    give: "The roadmap",
    take: "Continuous shipping",
  },
];

export function WhoWeHelp() {
  return (
    <section id="who" className="border-b border-ink/80 bg-paper-2/40">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mb-14 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-copper">
              № 03 / For whom
            </span>
            <h2 className="mt-6 font-display text-4xl font-light leading-[1] tracking-[-0.02em] text-ink md:text-6xl">
              Built for the people
              <br />
              <span className="italic">running the business.</span>
            </h2>
          </div>
        </div>

        <div className="grid gap-0 border border-ink md:grid-cols-3">
          {cards.map((c, i) => (
            <article
              key={c.title}
              className={`flex flex-col justify-between bg-paper p-8 ${
                i < cards.length - 1 ? "border-b border-ink md:border-b-0 md:border-r" : ""
              }`}
            >
              <div>
                <span className="stamp h-10 w-10 text-xl">{c.mark}</span>
                <h3 className="mt-8 font-display text-3xl font-normal leading-tight text-ink">
                  {c.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink/70">{c.body}</p>
              </div>
              <div className="mt-10 border-t border-ink/20 pt-4">
                <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/50">
                  <span>Given</span>
                  <span>↔</span>
                  <span className="text-right">Taken</span>
                </div>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-baseline gap-2 font-display text-[17px] italic text-ink">
                  <span>{c.give}</span>
                  <span className="text-copper not-italic">→</span>
                  <span className="text-right not-italic">{c.take}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
