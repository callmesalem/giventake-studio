import { Reveal } from "@/components/reveal";

/**
 * Founder note — replaces fake testimonials.
 * Honest positioning as a new studio. No fabricated case studies or quotes.
 */

export function Testimonials() {
  return (
    <section id="founder" className="border-b border-hairline">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <Reveal className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">A note from the founder</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            Why work with someone new.
          </h2>
        </Reveal>

        <div className="max-w-3xl">
          <Reveal delay={80}>
            <div className="card-lift rounded-2xl border border-hairline bg-white p-8 shadow-soft md:p-10">
              <div className="space-y-5 text-[16px] leading-[1.65] text-ink">
                <p>
                  GivenTake is a new studio. That means there&rsquo;s no case-study reel yet, and
                  I&rsquo;m not going to fabricate one to fill the page.
                </p>
                <p>
                  What you get instead is direct access to the person actually building your
                  product. No project manager relaying to a junior dev, no agency layer between you
                  and the work. If something is slow, or unclear, or wrong, you&rsquo;re talking to
                  whoever can fix it.
                </p>
                <p>
                  I build with AI coding agents and modern tools. That means I can prototype faster,
                  write less boilerplate, and spend more time on the parts that actually need
                  judgment: architecture, UX, and making sure the thing solves your problem.
                  It&rsquo;s not magic, and it&rsquo;s not a replacement for thinking. It&rsquo;s
                  just a better way to ship.
                </p>
                <p>
                  Early clients also get closer attention and more flexible scoping than an
                  established agency has time for. Rates reflect a team building its own track
                  record, not agency overhead.
                </p>
                <p className="text-muted-ink">
                  If that lines up with what you need, let&rsquo;s talk.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
