const quotes = [
  {
    quote:
      "Cut our client booking process from three days of back-and-forth to same-day. The team just uses the tool, no training required.",
    name: "Sarah Chen",
    role: "Owner, Meridian Studio",
    avatar: "from-violet-400 to-indigo-600",
  },
  {
    quote:
      "They shipped an MVP in seven weeks that I'd been trying to hire for over six months. We've had paying users on it since week two.",
    name: "Marcus Ohara",
    role: "Founder, Northlane AI",
    avatar: "from-emerald-300 to-teal-600",
  },
  {
    quote:
      "Replaced five spreadsheets with one dashboard the whole team actually opens. Invoicing went from a Friday afternoon to a five-minute thing.",
    name: "Priya Ramesh",
    role: "Ops Lead, Harbor & Co.",
    avatar: "from-amber-300 to-orange-500",
  },
];

export function Testimonials() {
  return (
    <section className="border-b border-hairline">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">Testimonials</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            What clients say when the work ships.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {quotes.map((q) => (
            <figure
              key={q.name}
              className="flex flex-col justify-between rounded-2xl border border-hairline bg-white p-7 shadow-soft"
            >
              <blockquote className="text-[17px] leading-[1.5] tracking-tight text-ink">
                &ldquo;{q.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-3 border-t border-hairline pt-5">
                <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${q.avatar}`} />
                <div>
                  <div className="text-[14px] font-semibold text-ink">{q.name}</div>
                  <div className="text-[12px] text-muted-ink">{q.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
