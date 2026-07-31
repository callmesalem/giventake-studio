import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { IconArrowRight } from "@/components/marks";
import { pageHead, BASE_URL, SITE_NAME } from "@/lib/seo";
import { offerBySlug, offers, type Offer } from "@/lib/offers";

export const Route = createFileRoute("/services/$slug")({
  loader: ({ params }) => {
    const offer = offerBySlug(params.slug);
    if (!offer) throw notFound();
    return offer;
  },
  head: ({ params }) => {
    const offer = offerBySlug(params.slug);
    if (!offer) {
      return {
        meta: [{ title: `Not found · ${SITE_NAME}` }, { name: "robots", content: "noindex" }],
      };
    }
    return {
      ...pageHead({
        path: `/services/${offer.slug}`,
        title: offer.metaTitle,
        description: offer.metaDescription,
      }),
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: offer.title,
            description: offer.metaDescription,
            serviceType: offer.title,
            provider: { "@id": `${BASE_URL}/#organization` },
            url: `${BASE_URL}/services/${offer.slug}`,
          }),
        },
      ],
    };
  },
  component: OfferPage,
});

function OfferPage() {
  // Cast: the hand-maintained routeTree.gen.ts doesn't carry loader inference
  // through until the router plugin regenerates it on the next dev/build run.
  const offer = Route.useLoaderData() as Offer;
  const others = offers.filter((o) => o.slug !== offer.slug).slice(0, 3);

  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-4xl px-6 py-16 md:py-20">
            <Link to="/" className="text-[13px] font-medium text-violet hover:underline">
              ← All services
            </Link>
            <h1 className="mt-5 font-display text-[38px] font-medium leading-[1.03] tracking-[-0.03em] text-ink md:text-[52px]">
              {offer.title}
            </h1>
            <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-muted-ink">
              {offer.tagline}
            </p>

            <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-5 border-t border-hairline pt-7">
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
                  Price
                </dt>
                <dd className="mt-1 text-[22px] font-semibold tracking-tight text-ink">
                  {offer.priceFrom}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
                  Timeline
                </dt>
                <dd className="mt-1 text-[22px] font-semibold tracking-tight text-ink">
                  {offer.timeline}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
                  Scope
                </dt>
                <dd className="mt-1 text-[22px] font-semibold tracking-tight text-ink">
                  Fixed, in writing
                </dd>
              </div>
            </dl>

            <a
              href="/#contact"
              className="btn-icon-nudge mt-10 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14px] font-medium text-white transition hover:opacity-90"
            >
              Start a project
              <IconArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        {/* Problem */}
        <section className="border-b border-hairline bg-secondary/50">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="font-display text-3xl font-medium tracking-[-0.03em] text-ink">
              Sound familiar?
            </h2>
            <ul className="mt-7 space-y-3.5">
              {offer.problem.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[16px] leading-relaxed text-ink">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 rounded-2xl border border-hairline bg-white p-7 shadow-soft">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-violet">
                What you get instead
              </p>
              <p className="mt-2.5 text-[16.5px] leading-relaxed text-ink">{offer.outcome}</p>
            </div>
          </div>
        </section>

        {/* Includes / excludes */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <h2 className="font-display text-2xl font-medium tracking-[-0.02em] text-ink">
                  What's included
                </h2>
                <ul className="mt-5 space-y-3">
                  {offer.includes.map((i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-[15px] leading-snug text-ink/85"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-display text-2xl font-medium tracking-[-0.02em] text-ink">
                  What's not
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-ink">
                  Stated up front so there are no surprises later. Anything here can be added — it
                  just gets scoped and priced separately.
                </p>
                <ul className="mt-5 space-y-3">
                  {offer.excludes.map((e) => (
                    <li
                      key={e}
                      className="flex items-start gap-2.5 text-[15px] leading-snug text-muted-ink"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-hairline" />
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Discovery questions — signals the process */}
        <section className="border-b border-hairline bg-secondary/50">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="font-display text-3xl font-medium tracking-[-0.03em] text-ink">
              What we'll ask you first
            </h2>
            <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-muted-ink">
              No code is written until the problem is understood and the scope is agreed. These are
              the questions that shape the build.
            </p>
            <ol className="mt-8 space-y-4">
              {offer.questions.map((q, i) => (
                <li key={q} className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-soft text-[12px] font-semibold text-violet">
                    {i + 1}
                  </span>
                  <span className="text-[16px] leading-relaxed text-ink">{q}</span>
                </li>
              ))}
            </ol>

            <div className="mt-10 rounded-2xl border border-hairline bg-white p-7 shadow-soft">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
                Is this a good fit?
              </p>
              <p className="mt-2.5 text-[16px] leading-relaxed text-ink">{offer.goodFit}</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <h2 className="font-display text-3xl font-medium tracking-[-0.03em] text-ink md:text-4xl">
              Start with a call.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[16.5px] leading-relaxed text-muted-ink">
              Thirty minutes, free, no obligation. You'll leave with a clear view of what this would
              take — whether or not you work with us.
            </p>
            <a
              href="/#contact"
              className="btn-icon-nudge mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14px] font-medium text-white transition hover:opacity-90"
            >
              Start a project
              <IconArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        {/* Other offers */}
        <section className="border-b border-hairline bg-secondary/50">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="text-[13px] font-medium text-violet">Other services</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {others.map((o: Offer) => (
                <Link
                  key={o.slug}
                  to="/services/$slug"
                  params={{ slug: o.slug }}
                  className="card-lift rounded-2xl border border-hairline bg-white p-5 shadow-soft transition"
                >
                  <p className="text-[15px] font-semibold leading-snug text-ink">{o.title}</p>
                  <p className="mt-2 text-[13px] text-muted-ink">{o.priceFrom}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
