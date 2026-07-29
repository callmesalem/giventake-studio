/**
 * Founder note — replaces fake testimonials.
 * Honest positioning as a new studio; placeholders clearly marked so
 * the owner can drop in real name/bio/photo before launch.
 */

export function Testimonials() {
  return (
    <section id="founder" className="border-b border-hairline">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">A note from the founder</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            Why work with someone new.
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_1.6fr]">
          {/* Photo + identity card */}
          <figure className="rounded-2xl border border-hairline bg-white p-6 shadow-soft">
            <div
              className="aspect-[4/5] w-full rounded-xl border border-hairline bg-secondary"
              role="img"
              aria-label="Founder photo placeholder"
            >
              <div className="flex h-full items-center justify-center text-[11px] font-mono uppercase tracking-[0.18em] text-muted-ink">
                Founder photo
              </div>
            </div>
            <figcaption className="mt-5">
              <div className="text-[15px] font-semibold text-ink">[Your name]</div>
              <div className="mt-1 text-[13px] leading-relaxed text-muted-ink">
                [One-line bio: e.g. &ldquo;X years building software, now doing it AI-native and fast.&rdquo;]
              </div>
            </figcaption>
          </figure>

          {/* Note */}
          <div className="rounded-2xl border border-hairline bg-white p-8 shadow-soft md:p-10">
            <div className="space-y-5 text-[16px] leading-[1.65] text-ink">
              <p>
                GivenTake is a new studio. That means there&rsquo;s no case-study
                reel yet, and I&rsquo;m not going to fabricate one to fill the page.
              </p>
              <p>
                What you get instead is direct access to the person actually building
                your product. No project manager relaying to a junior dev, no
                agency layer between you and the work. If something is slow, or
                unclear, or wrong, you&rsquo;re talking to whoever can fix it.
              </p>
              <p>
                Early clients also get closer attention and more flexible scoping
                than an established agency has time for. Rates reflect a team
                building its own track record, not agency overhead.
              </p>
              <p className="text-muted-ink">
                If that lines up with what you need, let&rsquo;s talk.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
