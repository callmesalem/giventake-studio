import { Reveal } from "@/components/reveal";
import { IconClose, IconCheckCircle } from "@/components/marks";

const usualWay = [
  "Pay $5,000+ upfront, then get handed the keys",
  "Every change costs extra or waits on your \u201cweb guy\u201d",
  "Hosting, security, and updates are your problem",
  "Nobody tells you if the site is actually working",
];

const ourWay = [
  "Custom builds start at $499, quoted in writing before work starts",
  "Payment plans and financing available, and you own the site",
  "Optional $99/mo care plan: hosting, updates, backups, small edits",
  "Every month on the care plan, a report in plain English: what's bringing you customers and what we'd fix next",
];

export function WhoWeHelp() {
  return (
    <section id="compare" className="border-b border-hairline">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <Reveal className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">How we're different</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            You own the site. We keep it earning.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-ink">
            Most small-business sites are built once, then left to quietly go stale. We do the
            opposite: a build you own outright, starting at $499, and an optional $99 a month to
            keep it fast, safe, and reporting back on the leads it brings you.
          </p>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-2">
          <Reveal>
            <article className="h-full rounded-2xl border border-hairline bg-secondary/50 p-7 md:p-8">
              <h3 className="text-[20px] font-semibold tracking-tight text-muted-ink">
                The usual way
              </h3>
              <ul className="mt-6 space-y-4">
                {usualWay.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-ink/10 text-muted-ink">
                      <IconClose className="h-3 w-3" />
                    </span>
                    <span className="text-[15px] leading-relaxed text-muted-ink">{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>

          <Reveal delay={100}>
            <article className="h-full rounded-2xl border border-ink bg-ink p-7 text-white shadow-lift md:p-8">
              <h3 className="text-[20px] font-semibold tracking-tight text-white">Our way</h3>
              <ul className="mt-6 space-y-4">
                {ourWay.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                      <IconCheckCircle className="h-3 w-3" />
                    </span>
                    <span className="text-[15px] leading-relaxed text-white/90">{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
