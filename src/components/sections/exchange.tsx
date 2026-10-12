import { Reveal } from "@/components/reveal";
import { BrandSignature } from "@/components/brand-signature";

/**
 * Hosts the brand signature (the woven "Exchange" loom) directly under the
 * trusted band. Each thread in the loom is a link to a section further down
 * the page, so this doubles as a visual table of contents.
 */
export function Exchange() {
  return (
    <section id="exchange" className="border-b border-hairline">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 md:py-28 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <Reveal>
          <div>
            <p className="text-[13px] font-medium text-violet">The exchange</p>
            <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
              You give us the problem. You get back the thing that fixes it.
            </h2>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted-ink">
              Every project is the same trade. An idea, a brief, a problem, or a deadline goes in. A
              product, a system, a fix, or a launch comes out. Pick a thread to jump to that part of
              the page.
            </p>
          </div>
        </Reveal>
        <Reveal delay={90}>
          <BrandSignature />
        </Reveal>
      </div>
    </section>
  );
}
