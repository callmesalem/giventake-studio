import { createFileRoute, Link } from "@tanstack/react-router";
import { ProsePage, H2, P, Bullets, Callout } from "@/components/prose-page";
import { pageHead, breadcrumbList, BASE_URL, ORGANIZATION_ID } from "@/lib/seo";

/**
 * Trade page, keyword map #6. "hvac website design" is 480/mo with a $43 CPC
 * (docs/audits/2026-10-13-keywords.md). First of the trade pages; plumber,
 * restaurant and landscaping follow only if this one earns traffic.
 *
 * Every claim is about how HVAC businesses get work and what we build for it.
 * No invented clients, results, or statistics.
 */

const PATH = "/hvac-website-design";

export const Route = createFileRoute("/hvac-website-design")({
  head: () => ({
    ...pageHead({
      path: PATH,
      title: "HVAC Website Design for Heating and Cooling · GivenTake Devs",
      description:
        "HVAC website design for heating and cooling companies: tap-to-call for no-heat calls, service-area pages, maintenance plan sign-ups. From $1,999.",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "HVAC website design",
          serviceType: "Web design",
          audience: { "@type": "BusinessAudience", name: "HVAC contractors" },
          provider: { "@id": ORGANIZATION_ID },
          areaServed: [
            { "@type": "State", name: "Ohio" },
            { "@type": "Country", name: "United States" },
          ],
          offers: { "@type": "Offer", price: "1999", priceCurrency: "USD" },
          url: `${BASE_URL}${PATH}`,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbList([
            { name: "Home", path: "/" },
            { name: "HVAC website design", path: PATH },
          ]),
        ),
      },
    ],
  }),
  component: HvacPage,
});

function HvacPage() {
  return (
    <ProsePage
      eyebrow="Heating and cooling contractors"
      title="Websites for HVAC companies."
      lede="When a furnace quits in January, the homeowner searches on a phone and calls whoever makes it easiest. We build HVAC websites around that moment, and around the quieter work that keeps the schedule full the rest of the year."
    >
      <H2>Built for how HVAC work comes in</H2>
      <Bullets
        items={[
          <>
            <strong>No-heat and no-cool calls.</strong> Your number is one tap away on every page,
            and the site says plainly whether you take after-hours calls.
          </>,
          <>
            <strong>Seasonal swings.</strong> Furnace and AC pages you can bring to the front as the
            weather turns, without calling a developer.
          </>,
          <>
            <strong>Maintenance plans.</strong> A page that explains your plan and lets people sign
            up, so tune-ups fill the slow months.
          </>,
          <>
            <strong>Replacement quotes.</strong> A short form for new systems that asks the
            questions you&rsquo;d ask on the phone: home size, current system, fuel type.
          </>,
          <>
            <strong>Trust details.</strong> Your license, insurance, EPA 608 and any manufacturer
            dealer status shown where buyers look before they call.
          </>,
          <>
            <strong>Financing.</strong> If you offer it, a clear page about it, because a new system
            is a big bill.
          </>,
          <>
            <strong>The towns you cover.</strong> A service-area section, so you show up when people
            search for heating and cooling near them.
          </>,
        ]}
      />

      <H2>What it costs</H2>
      <P>
        HVAC sites are built on our{" "}
        <Link
          to="/services/$slug"
          params={{ slug: "websites-for-contractors" }}
          className="font-semibold text-ink underline"
        >
          contractor website
        </Link>{" "}
        service, from $1,999, with a fixed written quote before work starts and a list of what
        isn&rsquo;t included. You own the site and the code. Hosting and upkeep are optional on the
        $99/mo care plan.
      </P>
      <P>
        Online booking, dispatch tools and reminder emails for maintenance customers are separate
        work, quoted on their own. See{" "}
        <Link
          to="/services/$slug"
          params={{ slug: "booking-and-payments" }}
          className="font-semibold text-ink underline"
        >
          booking and payments
        </Link>{" "}
        and{" "}
        <Link
          to="/services/$slug"
          params={{ slug: "business-automation" }}
          className="font-semibold text-ink underline"
        >
          business automation
        </Link>
        .
      </P>

      <H2>What we don&rsquo;t do</H2>
      <P>
        We don&rsquo;t run ads, sell leads, or tie you to a monthly contract to keep your own site.
        If paid ads are what you need, we&rsquo;ll tell you that and point you elsewhere.
      </P>

      <H2>Where we are as a studio</H2>
      <P>
        We&rsquo;re based in Parma, Ohio. We meet in person within about 30 to 45 minutes and by
        video anywhere in the US. Everything we&rsquo;ve built so far has been for our own business,
        and we&rsquo;re now taking on outside clients. We haven&rsquo;t built an HVAC site for a
        client yet, so we have no HVAC reviews to show you, and we won&rsquo;t invent any. You get
        the founder on every call.
      </P>

      <Callout title="Want a number for your company?">
        <Link to="/book" className="font-semibold text-ink underline">
          Book a call
        </Link>{" "}
        or use the form on the{" "}
        <Link to="/" hash="contact" className="font-semibold text-ink underline">
          homepage
        </Link>
        , and we&rsquo;ll send a written quote.
      </Callout>
    </ProsePage>
  );
}
