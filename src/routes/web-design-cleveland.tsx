import { createFileRoute, Link } from "@tanstack/react-router";
import { ProsePage, H2, P, Bullets, Callout } from "@/components/prose-page";
import { pageHead, breadcrumbList, BASE_URL, ORGANIZATION_ID } from "@/lib/seo";

/**
 * Location page, Phase 3.3 of the exposure plan. "web design cleveland" is
 * 170/mo at KD 9 (docs/audits/2026-10-13-keywords.md).
 *
 * Not a doorway page: every claim here is a fact about how we work in the area
 * (meeting radius, in-person vs virtual, our track record). Don't clone it per
 * suburb with the city name swapped; add a town page only with town-specific
 * substance.
 */

const PATH = "/web-design-cleveland";

export const Route = createFileRoute("/web-design-cleveland")({
  head: () => ({
    ...pageHead({
      path: PATH,
      title: "Web Design in Cleveland for Small Businesses · GivenTake Devs",
      description:
        "Small business web design in Cleveland and Northeast Ohio from a Parma-based studio. Meet in person or online, fixed written quotes from $499, and you own the site.",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Small business web design in Cleveland",
          serviceType: "Web design",
          provider: { "@id": ORGANIZATION_ID },
          areaServed: [
            { "@type": "City", name: "Cleveland" },
            { "@type": "State", name: "Ohio" },
            { "@type": "Country", name: "United States" },
          ],
          url: `${BASE_URL}${PATH}`,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbList([
            { name: "Home", path: "/" },
            { name: "Web design in Cleveland", path: PATH },
          ]),
        ),
      },
    ],
  }),
  component: ClevelandPage,
});

function ClevelandPage() {
  return (
    <ProsePage
      eyebrow="Cleveland and Northeast Ohio"
      title="Web design for Cleveland small businesses."
      lede="GivenTake Devs is a small web studio based in Parma, about twenty minutes from downtown Cleveland. We build websites and the software behind them for small businesses, quote every project in writing before work starts, and hand you a site you own outright."
    >
      <H2>Meet in person, or don&rsquo;t</H2>
      <P>
        If you&rsquo;re within roughly 30 to 45 minutes of Parma, we can meet at your shop, office or
        job site. That covers Cleveland, Lakewood, Westlake, Strongsville, North Royalton,
        Independence, Brunswick, Medina, and most of Cuyahoga County. Seeing how a business actually
        runs is often the fastest way to work out what the site needs to do.
      </P>
      <P>
        Video calls work just as well if that suits you better. We take on clients anywhere in Ohio
        and across the United States the same way.
      </P>

      <H2>What we build</H2>
      <Bullets
        items={[
          <>
            <strong>Marketing websites</strong> your team can update without a developer.{" "}
            <Link
              to="/services/$slug"
              params={{ slug: "marketing-site" }}
              className="font-semibold text-ink underline"
            >
              From $499
            </Link>
            .
          </>,
          <>
            <strong>Sites for contractors and home-service trades</strong>, with tap-to-call, quote
            forms, and a page listing the towns you cover.{" "}
            <Link
              to="/services/$slug"
              params={{ slug: "websites-for-contractors" }}
              className="font-semibold text-ink underline"
            >
              See what&rsquo;s included
            </Link>
            .
          </>,
          <>
            <strong>Booking, payments, and lead intake</strong> built into your site, so enquiries
            don&rsquo;t sit in an inbox.
          </>,
          <>
            <strong>Dashboards and automations</strong> that replace the spreadsheets and the
            repetitive admin.
          </>,
        ]}
      />
      <P>
        Every service, with prices and what&rsquo;s not included, is on the{" "}
        <Link to="/services" className="font-semibold text-ink underline">
          services page
        </Link>
        .
      </P>

      <H2>Where we are as a studio</H2>
      <P>
        Everything we&rsquo;ve built so far has been for our own business: the websites, the CRM,
        and the automations that run it day to day. We&rsquo;re now taking on outside clients, so a
        Cleveland business that hires us now would be one of the first. That means you get the
        founder on every call and every line of code. It also means we have no client reviews to
        show you yet, and we won&rsquo;t invent any.
      </P>
      <P>
        What we can show you is how we work. The{" "}
        <Link to="/process" className="font-semibold text-ink underline">
          process
        </Link>{" "}
        is published in full, the{" "}
        <Link to="/pricing" className="font-semibold text-ink underline">
          prices
        </Link>{" "}
        are public, and every quote includes a written list of what isn&rsquo;t included.
      </P>

      <Callout title="Not sure what it would cost?">
        Our guide to{" "}
        <Link
          to="/articles/$slug"
          params={{ slug: "small-business-website-cost" }}
          className="font-semibold text-ink underline"
        >
          what a small business website costs
        </Link>{" "}
        covers DIY builders, freelancers, studios and agencies, including what you should expect to
        pay elsewhere.
      </Callout>
    </ProsePage>
  );
}
