import { Reveal } from "@/components/reveal";

/**
 * Studio note — replaces fake testimonials.
 *
 * Honest positioning as a new studio. No fabricated case studies or quotes.
 *
 * Brand voice: "we" refers to the studio as a company, which is standard and
 * accurate. Do NOT add headcount claims ("our team of developers", "our
 * engineers"), invented staff, or stock photography of people — for a services
 * buyer, headcount is material and it is discoverable in one call.
 */

export function Testimonials() {
  return (
    <section id="founder" className="border-b border-hairline">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <Reveal className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">Straight answer</p>
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
                  we&rsquo;re not going to fabricate one to fill the page. Everything shown under
                  &ldquo;work&rdquo; is labelled for what it is.
                </p>
                <p>
                  What you get instead is direct access to whoever is actually building your
                  product. No project manager relaying to a junior dev, no agency layer between you
                  and the work. If something is slow, or unclear, or wrong, you&rsquo;re talking to
                  whoever can fix it.
                </p>
                <p>
                  We build with AI coding agents and modern tools. That means faster prototypes,
                  less boilerplate, and more time on the parts that actually need judgment:
                  architecture, UX, and making sure the thing solves your problem. It&rsquo;s not
                  magic, and it&rsquo;s not a replacement for thinking. It&rsquo;s just a better way
                  to ship.
                </p>
                <p>
                  Early clients also get closer attention and more flexible scoping than an
                  established agency has time for. Rates reflect a studio building its own track
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
