/**
 * Honest "trusted partner" band — no fake client logos.
 * A new studio has no client list to display, so this section states
 * what the studio actually does instead of fabricating one.
 */

const facts = [
  { k: "Founder-led", v: "Every project" },
  { k: "Weeks, not quarters", v: "Typical timeline" },
  { k: "Built in the open", v: "Weekly demos" },
  { k: "No lock-in", v: "You own the code" },
];

export function TrustedPartner() {
  return (
    <section className="border-b border-hairline bg-paper">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <p className="text-center text-[12px] font-medium uppercase tracking-[0.18em] text-muted-ink">
          What working with us actually looks like
        </p>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
          {facts.map((f) => (
            <div
              key={f.k}
              className="flex flex-col items-center text-center"
            >
              <div className="text-[18px] font-semibold tracking-tight text-ink">
                {f.k}
              </div>
              <div className="mt-1 text-[12px] text-muted-ink">{f.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
