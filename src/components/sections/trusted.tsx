import { GlyphExchange, GlyphFrame, GlyphStack, GlyphSpark, GlyphLoop, GlyphKey } from "@/components/marks";

const items = [
  { g: GlyphFrame, label: "Websites" },
  { g: GlyphStack, label: "Web Apps" },
  { g: GlyphSpark, label: "AI Systems" },
  { g: GlyphLoop, label: "Automation" },
  { g: GlyphKey, label: "Portals" },
  { g: GlyphExchange, label: "Internal Tools" },
];

export function TrustedPartner() {
  return (
    <section className="border-b border-ink/80">
      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-6 py-20 md:py-28">
        <div className="col-span-12 lg:col-span-5">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-copper">
            № 02 / The Trade
          </span>
          <h2 className="mt-6 font-display text-4xl font-light leading-[1] tracking-[-0.02em] text-ink md:text-6xl">
            You focus on the business.
            <br />
            <span className="italic">We build the technology.</span>
          </h2>
        </div>
        <div className="col-span-12 lg:col-span-6 lg:col-start-7 lg:pt-6">
          <p className="max-w-md font-display text-xl italic leading-snug text-ink/70">
            One team doing the work you'd normally split across five or six freelancers. You get one point of contact and one system that fits together.
          </p>
          <div className="mt-10 grid grid-cols-2 divide-x divide-y divide-ink/20 border border-ink/20 sm:grid-cols-3">
            {items.map(({ g: G, label }) => (
              <div key={label} className="flex items-center gap-3 bg-paper px-4 py-5">
                <G className="h-6 w-6 text-copper" />
                <span className="font-display text-lg text-ink">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
