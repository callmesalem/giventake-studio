import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Pricing } from "@/components/sections/pricing";
import { FAQ } from "@/components/sections/faq";
import { faqs } from "@/lib/faq-data";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    ...pageHead({
      path: "/pricing",
      title: "Pricing · Fixed Scope, Fixed Price · GivenTake Devs",
      description:
        "Transparent tiers from small fixes to full builds, plus a paid discovery sprint for fuzzy scopes. Every engagement is a fixed scope and a fixed price in writing before any code is written.",
    }),
    // The FAQ lives here alongside pricing, so its structured data moves with it.
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />
      <main>
        <Pricing />
        <FAQ />
      </main>
      <SiteFooter />
    </div>
  );
}
