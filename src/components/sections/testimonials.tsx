const testimonials = [
  {
    quote: "We went from a Notion doc to a working product in six weeks. It's the closest thing to hiring a CTO without hiring a CTO.",
    name: "Alex Rivera",
    role: "Founder, Northlane",
  },
  {
    quote: "They replaced three tools and a part-time contractor. Our team actually enjoys using what they built for us.",
    name: "Priya Menon",
    role: "COO, Meridian Logistics",
  },
  {
    quote: "Every week there was a demo. Every week it got better. I never had to translate my ideas into engineer.",
    name: "James Whitaker",
    role: "Owner, Harbor & Co.",
  },
];

export function Testimonials() {
  return (
    <section className="border-b border-ink/80">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mb-14 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-copper">
              № 07 / On the record
            </span>
            <h2 className="mt-6 font-display text-4xl font-light leading-[1] tracking-[-0.02em] text-ink md:text-6xl">
              Trusted by founders
              <br />
              <span className="italic">and operators.</span>
            </h2>
          </div>
        </div>

        <div className="grid gap-0 border border-ink md:grid-cols-3">
          {testimonials.map((t, i) => (
            <figure
              key={t.name}
              className={`flex flex-col justify-between bg-paper p-8 ${
                i < testimonials.length - 1 ? "border-b border-ink md:border-b-0 md:border-r" : ""
              }`}
            >
              <span aria-hidden className="font-display text-6xl italic leading-none text-copper">"</span>
              <blockquote className="mt-2 font-display text-[22px] font-normal leading-[1.3] text-ink">
                {t.quote}
              </blockquote>
              <figcaption className="mt-8 flex items-baseline justify-between border-t border-ink/20 pt-4">
                <div>
                  <div className="font-display text-lg italic text-ink">{t.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/50">
                    {t.role}
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/40">
                  №0{i + 1}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
