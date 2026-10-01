import { Reveal } from "@/components/reveal";
import { IconArrowRight } from "@/components/marks";

const buildPoints = [
  "Every project gets a written quote and proposal before any work starts",
  "Payment plans and financing available, so the whole bill isn't due at once",
  "You own the site outright: the design, the code, the content, the domain",
  "Designed around the one action you want a visitor to take",
  "Speed-tested on real phones before launch, and you get the numbers",
];

const carePlanIncluded = [
  "Hosting",
  "Security updates",
  "Backups",
  "Uptime monitoring",
  "Small content edits, a few per month, published within 2 business days",
  "The monthly proof report: leads, where they came from, what we changed, what worked, and what's next",
];

const carePlanExcluded = ["New pages", "New features", "Redesigns"];

const included = [
  "You own your domain, your content, and your customer data. Always.",
  "The quote is written down before work starts, and the price in it is the price.",
  "A human reviews everything before it ships",
  "Changes are one email away. No dashboard to learn, no ticket queue.",
  "The care plan is optional. Cancel it any time and the site stays yours.",
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-hairline bg-secondary/50">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <Reveal className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">Pricing</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            Custom websites, starting at $499.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-ink">
            Not a template someone configured. A site built for your business, scoped on a call and
            quoted in writing before anyone starts work. Payment plans and financing are available,
            and the site is yours to keep.
          </p>
        </Reveal>

        {/* headline offer */}
        <Reveal>
          <article className="rounded-2xl border border-ink bg-ink p-7 text-white shadow-lift md:p-9">
            <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
              <div className="flex-1">
                <h3 className="text-[22px] font-semibold tracking-tight text-white">
                  Custom website build
                </h3>
                <p className="mt-1.5 text-[14.5px] text-white/70">
                  One project, one written quote, one owner at the end of it: you.
                </p>
                <ul className="mt-6 space-y-3">
                  {buildPoints.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2.5 text-[14.5px] leading-snug text-white/85"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-start gap-5 md:items-end">
                <div className="md:text-right">
                  <p className="text-[13px] font-medium uppercase tracking-wide text-white/50">
                    Starting at
                  </p>
                  <p className="mt-1 text-[40px] font-semibold leading-none tracking-tight text-white">
                    $499
                  </p>
                  <p className="mt-2 max-w-[16rem] text-[13px] leading-snug text-white/60">
                    Final price depends on scope. You see it in writing before you commit.
                  </p>
                </div>
                <a
                  href="/#contact"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-5 py-3 text-[13px] font-medium text-ink transition hover:bg-white/90"
                >
                  Get a quote
                  <IconArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </article>
        </Reveal>

        {/* optional care plan */}
        <Reveal delay={80}>
          <article className="card-lift mt-4 rounded-2xl border border-hairline bg-white p-7 shadow-soft md:p-9">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-[22px] font-semibold tracking-tight text-ink">
                  Care plan, if you want it
                </h3>
                <p className="mt-1.5 text-[14.5px] text-muted-ink">
                  Optional. Cancel any time. The site is yours either way.
                </p>
              </div>
              <p className="text-[32px] font-semibold leading-none tracking-tight text-ink">
                $99
                <span className="text-[16px] font-medium text-muted-ink">/mo</span>
              </p>
            </div>

            <div className="mt-7 grid gap-7 border-t border-hairline pt-7 md:grid-cols-2 md:gap-10">
              <div>
                <h4 className="text-[15px] font-semibold text-ink">What's included</h4>
                <ul className="mt-4 space-y-2.5">
                  {carePlanIncluded.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-[14px] leading-snug text-ink/85"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[15px] font-semibold text-ink">What isn't</h4>
                <ul className="mt-4 space-y-2.5">
                  {carePlanExcluded.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-[14px] leading-snug text-muted-ink"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink/20" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[13.5px] leading-relaxed text-muted-ink">
                  Those are project work. We scope them and quote them separately, so you always
                  know what you're agreeing to.
                </p>
              </div>
            </div>

            <a
              href="/#contact"
              className="btn-icon-nudge mt-8 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-3 text-[13px] font-medium text-white transition hover:opacity-90"
            >
              Get a quote
              <IconArrowRight className="h-4 w-4" />
            </a>
          </article>
        </Reveal>

        {/* transparent expectations block */}
        <Reveal delay={120}>
          <div className="mt-14 rounded-2xl border border-hairline bg-white p-7 shadow-soft">
            <h3 className="text-[18px] font-semibold text-ink">What you can count on</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted-ink">
              The fine print, up front. The usual way of buying websites hides it.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {included.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] leading-snug text-ink/85"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        {/* non-website work lives on /services; give it a path from here */}
        <Reveal delay={140}>
          <p className="mx-auto mt-12 max-w-2xl text-center text-[15px] leading-relaxed text-muted-ink">
            Need something that isn&rsquo;t a website? Dashboards, automations, and booking systems
            are scoped on a call and priced fixed, in writing.{" "}
            <a
              href="/services"
              className="font-medium text-violet underline-offset-4 hover:underline"
            >
              See services and starting prices
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
