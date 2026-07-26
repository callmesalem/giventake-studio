import { Button } from "@/components/ui/button";
import { AmpersandMark, ScribedUnderline, ArrowRightThin } from "@/components/marks";

const ledger = [
  ["idea", "product"],
  ["sketch", "system"],
  ["notion", "software"],
  ["prompt", "platform"],
  ["backlog", "shipped"],
  ["problem", "process"],
];

export function Hero() {
  return (
    <section className="relative border-b border-ink/80">
      {/* top masthead rule */}
      <div className="border-b border-ink/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-ink/70">
          <span>Vol. 001 · The Trade Ledger</span>
          <span className="hidden sm:inline">Est. 2024 · Made by hand</span>
          <span>Issue №{new Date().getFullYear()}</span>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-6 pt-14 pb-20 md:pt-20 md:pb-28">
        {/* LEFT — editorial headline */}
        <div className="col-span-12 lg:col-span-8">
          <div className="mb-8 flex items-center gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
              № 01 / Manifesto
            </span>
            <span className="h-px flex-1 bg-ink/25" />
          </div>

          <h1 className="font-display text-[13vw] font-light leading-[0.92] tracking-[-0.02em] text-ink md:text-[104px]">
            Stop looking
            <br />
            for developers.
            <br />
            <span className="relative inline-block">
              <span className="italic font-normal">Start building.</span>
              <ScribedUnderline className="absolute left-[2%] right-[2%] top-full h-[0.35em] w-[96%] text-copper" />
            </span>
          </h1>

          <div className="mt-12 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <p className="max-w-xl text-lg leading-[1.55] text-ink/75 md:text-xl">
              We're a small development team that businesses hire instead of trying to
              find, vet, and manage engineers themselves. You tell us what you need built.
              A few weeks later, you're using it.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col md:items-end">
              <Button asChild size="lg" className="h-11 rounded-none bg-ink px-6 font-mono text-[12px] uppercase tracking-[0.2em] text-paper hover:bg-copper">
                <a href="#contact">Book a call</a>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-11 rounded-none px-2 font-mono text-[12px] uppercase tracking-[0.2em] text-ink hover:bg-transparent hover:text-copper">
                <a href="#work">See the work &rarr;</a>
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT — the signature Trade Ledger */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="sticky top-24 border border-ink bg-paper">
            <div className="flex items-center justify-between border-b border-ink px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink">
              <span>The Trade Ledger</span>
              <AmpersandMark className="h-5 w-5 text-ink" />
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-ink/60 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
              <span>Given</span>
              <span className="px-3">↔</span>
              <span className="text-right">Taken</span>
            </div>
            <ul>
              {ledger.map(([given, taken], i) => (
                <li
                  key={given}
                  className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 font-display text-[18px] italic text-ink ${
                    i < ledger.length - 1 ? "border-b border-ink/15" : ""
                  }`}
                >
                  <span>{given}</span>
                  <ArrowRightThin className="h-3 w-6 text-copper" />
                  <span className="text-right not-italic font-normal">{taken}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-ink bg-ink px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-paper">
              <span>Signed</span>
              <span className="font-display text-base italic normal-case tracking-normal">GivenTake &amp; Co.</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
