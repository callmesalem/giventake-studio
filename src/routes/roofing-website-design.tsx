import { createFileRoute, Link } from "@tanstack/react-router";
import { ProsePage, H2, P, Bullets, Callout } from "@/components/prose-page";
import { pageHead, breadcrumbList, BASE_URL, ORGANIZATION_ID } from "@/lib/seo";

/**
 * Trade page, second after /hvac-website-design and built the same way.
 *
 * Every claim is about how roofing companies get work and what we build for it.
 * No invented clients, results, or statistics. Insurance copy stays on the
 * roofer's side of the line: explain the process, never imply they negotiate
 * the claim for the homeowner.
 */

const PATH = "/roofing-website-design";

export const Route = createFileRoute("/roofing-website-design")({
  head: () => ({
    ...pageHead({
      path: PATH,
      title: "Roofing Website Design for Roofing Contractors · GivenTake Devs",
      description:
        "Roofing website design for roofing contractors: tap-to-call for storm and leak calls, estimate forms with photo upload, service-area pages. From $1,999.",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Roofing website design",
          serviceType: "Web design",
          audience: { "@type": "BusinessAudience", name: "Roofing contractors" },
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
            { name: "Roofing website design", path: PATH },
          ]),
        ),
      },
    ],
  }),
  component: RoofingPage,
});

function RoofingPage() {
  return (
    <ProsePage
      eyebrow="Roofing contractors"
      title="Websites for roofing companies."
      lede="After a storm, a homeowner with a leak searches on a phone and calls the roofer who looks trustworthy and is easy to reach. A full replacement is a bigger, slower decision. We build roofing websites that handle both."
    >
      <H2>Built for how roofing work comes in</H2>
      <Bullets
        items={[
          <>
            <strong>Leak and storm calls.</strong> Your number is one tap away on every page, and
            the site says plainly whether you do emergency tarping and after-hours calls.
          </>,
          <>
            <strong>Estimate requests with photos.</strong> A short form that asks what you&rsquo;d
            ask on the phone (roof age, material, where it leaks) and lets the homeowner attach
            photos, so you know what you&rsquo;re walking into.
          </>,
          <>
            <strong>Insurance claims, explained.</strong> If you work on insured storm jobs, a plain
            page on how that goes with you: inspection, documentation, and what the homeowner
            handles with their insurer.
          </>,
          <>
            <strong>Materials you install.</strong> Pages for shingle, metal, flat roofing or
            whatever you actually do, so people searching for them find you.
          </>,
          <>
            <strong>Trust details.</strong> Your registration, insurance, warranty terms and any
            manufacturer certification shown where buyers look before they call.
          </>,
          <>
            <strong>Finished jobs.</strong> A gallery you can add before-and-after photos to from
            your phone.
          </>,
          <>
            <strong>The towns you cover.</strong> A service-area section, so you show up when people
            search for roofers near them.
          </>,
        ]}
      />

      <H2>What it costs</H2>
      <P>
        Roofing sites are built on our{" "}
        <Link
          to="/services/$slug"
          params={{ slug: "websites-for-contractors" }}
          className="font-semibold text-ink underline"
        >
          contractor website
        </Link>{" "}
        service, from $1,999, with a fixed written quote before work starts and a list of what
        isn&rsquo;t included. You own the site and the code. Prefer nothing upfront? The own-it plan
        is $0 down and $149/mo for 12 months on a standard site. Hosting and upkeep are optional on
        the $99/mo care plan, or $49/mo for hosting only. Full details are on the{" "}
        <Link to="/pricing" className="font-semibold text-ink underline">
          pricing page
        </Link>
        .
      </P>
      <P>
        Follow-up emails after an estimate, job tracking, and scheduling for inspections are
        separate work, quoted on their own. See{" "}
        <Link
          to="/services/$slug"
          params={{ slug: "business-automation" }}
          className="font-semibold text-ink underline"
        >
          business automation
        </Link>{" "}
        and{" "}
        <Link
          to="/services/$slug"
          params={{ slug: "booking-and-payments" }}
          className="font-semibold text-ink underline"
        >
          booking and payments
        </Link>
        .
      </P>

      <H2>What we don&rsquo;t do</H2>
      <P>
        We don&rsquo;t run ads, sell storm leads, or tie you to a monthly contract to keep your own
        site. If paid ads are what you need, we&rsquo;ll tell you that and point you elsewhere.
      </P>

      <H2>Where we are as a studio</H2>
      <P>
        We&rsquo;re based in Cleveland, Ohio. We meet in person within about 30 to 45 minutes and by
        video anywhere in the US. Everything we&rsquo;ve built so far has been for our own business,
        and we&rsquo;re now taking on outside clients. We haven&rsquo;t built a roofing site for a
        client yet, so we have no roofing reviews to show you, and we won&rsquo;t invent any. You
        get the founder on every call.
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
