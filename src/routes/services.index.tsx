import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { OfferCard } from "@/components/offer-card";
import { IconArrowRight } from "@/components/marks";
import { pageHead } from "@/lib/seo";
import { offers } from "@/lib/offers";

export const Route = createFileRoute("/services/")({
  head: () =>
    pageHead({
      path: "/services",
      title: "Services & Pricing · GivenTake Devs",
      description:
        "Fixed-price software development: internal dashboards, AI automation, booking systems, marketing sites, and MVPs. Website builds start at $499, with an optional $99/mo care plan. Real prices, real timelines, explicit exclusions.",
    }),
  component: ServicesIndexPage,
});

function ServicesIndexPage() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />

      <main>
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
            <p className="text-[13px] font-medium text-violet">Services</p>
            <h1 className="mt-3 font-display text-[38px] font-medium leading-[1.03] tracking-[-0.03em] text-ink md:text-[52px]">
              What we build, and what it costs.
            </h1>
            <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-muted-ink">
              Every project is scoped on a call and quoted in writing before work starts, but these
              are the shapes we build most often. Each page lists what&rsquo;s included, what
              isn&rsquo;t, and where the price starts, so you can judge fit before booking a call.
            </p>
            <p className="mt-4 max-w-2xl text-[18px] leading-relaxed text-muted-ink">
              Website builds start at $499. Payment plans and financing are available, and you own
              the site. Hosting and upkeep are an optional $99 a month.{" "}
              <Link
                to="/pricing"
                className="font-medium text-violet underline-offset-4 hover:underline"
              >
                See website pricing and the care plan
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="border-b border-hairline bg-secondary/50">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => (
                <OfferCard key={o.slug} offer={o} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-hairline">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-hairline bg-white p-6 shadow-soft">
                <h2 className="text-[16px] font-semibold text-ink">Not sure which one?</h2>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted-ink">
                  Mapping your current process is part of quoting the work, not a separate purchase.
                  You get a written scope, an approach, a timeline, and a price before you commit to
                  anything.
                </p>
                <Link
                  to="/process"
                  className="btn-icon-nudge mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-violet"
                >
                  How we work
                  <IconArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="rounded-2xl border border-hairline bg-white p-6 shadow-soft">
                <h2 className="text-[16px] font-semibold text-ink">Built with AI agents</h2>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted-ink">
                  That&rsquo;s how the timelines are short. Everything is reviewed by a human before
                  it ships, and we&rsquo;ll tell you exactly what that means, including the parts
                  most studios won&rsquo;t.
                </p>
                <Link
                  to="/how-we-use-ai"
                  className="btn-icon-nudge mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-violet"
                >
                  How we use AI
                  <IconArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="rounded-2xl border border-hairline bg-white p-6 shadow-soft">
                <h2 className="text-[16px] font-semibold text-ink">Something else entirely?</h2>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted-ink">
                  These are starting points, not a menu. If what you need isn&rsquo;t here, describe
                  it and we&rsquo;ll tell you honestly whether we&rsquo;re the right people to build
                  it.
                </p>
                <a
                  href="/#contact"
                  className="btn-icon-nudge mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-violet"
                >
                  Start a project
                  <IconArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
