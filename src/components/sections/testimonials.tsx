export function Testimonials() {
  return (
    <section className="border-b border-ink/80">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mb-14 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-copper">
              № 07 / A note from the founder
            </span>
            <h2 className="mt-6 font-display text-4xl font-light leading-[1] tracking-[-0.02em] text-ink md:text-6xl">
              Why work with
              <br />
              <span className="italic">someone new.</span>
            </h2>
          </div>
        </div>

        <div className="grid gap-0 border border-ink md:grid-cols-12">
          {/* Founder note */}
          <div className="md:col-span-8 border-b border-ink/20 md:border-b-0 md:border-r bg-paper p-8 md:p-12">
            <span aria-hidden className="font-display text-6xl italic leading-none text-copper">
              "
            </span>
            <div className="mt-2 space-y-5 font-display text-[22px] font-normal leading-[1.35] text-ink md:text-[24px]">
              <p>
                Most agencies put a project manager between you and the person actually writing
                the code. You explain what you want, they explain it to a junior dev, and the
                thing that comes back is a lossy copy of what you asked for.
              </p>
              <p>
                Here, you talk to me. I scope it, I build it, I ship it. If something in your
                business changes mid-project, we adjust the same week, not next quarter.
              </p>
              <p>
                Because we're new, early clients get closer attention and more flexible scoping
                than a booked-out agency has time for. That's the trade: you take a chance on a
                newer studio, we give you the kind of care an established shop can't.
              </p>
            </div>

            <figcaption className="mt-10 flex items-center gap-5 border-t border-ink/20 pt-6">
              {/* Founder photo placeholder */}
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-ink/30 bg-paper-2">
                <div className="absolute inset-0 flex items-center justify-center font-display text-2xl italic text-ink/40">
                  [Photo]
                </div>
              </div>
              <div>
                <div className="font-display text-xl italic text-ink">[Founder Name]</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
                  Built by [Name] · [X years] building software, now doing it AI-native and fast
                </div>
              </div>
            </figcaption>
          </div>

          {/* Side ledger */}
          <aside className="md:col-span-4 bg-paper-2/40 p-8 md:p-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/50">
              The trade
            </p>
            <ul className="mt-6 space-y-5 font-display text-[18px] leading-snug text-ink">
              <li>
                <span className="italic text-copper">You take:</span> direct access to the
                builder, weekly progress you can see, honest scope.
              </li>
              <li>
                <span className="italic text-copper">We take:</span> a chance to prove the work,
                and a client we'll still be building for in three years.
              </li>
            </ul>

            <div className="mt-10 border-t border-ink/20 pt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/50">
                Signed
              </p>
              <p className="mt-2 font-display text-xl italic text-ink">[Founder Name]</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/50">
                Founder, GivenTake Goods Devs
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
