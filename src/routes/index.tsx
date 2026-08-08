import { lazy, Suspense, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Hero } from "@/components/sections/hero";
import { TrustedPartner } from "@/components/sections/trusted";
import { faqs } from "@/lib/faq-data";
import { BASE_URL, OG_IMAGE_URL as ogImageUrl } from "@/lib/seo";

/* Only the header, hero and the row directly under it ship in the critical
   bundle. Everything below the fold is a separate chunk: the server still
   streams the full HTML (so crawlers and no-JS visitors see every section),
   and the browser hydrates each boundary as its chunk arrives, after the LCP
   headline has already painted. */
const named = <K extends string>(key: K, load: () => Promise<Record<K, ComponentType>>) =>
  lazy(() => load().then((m) => ({ default: m[key] })));

const WhoWeHelp = named("WhoWeHelp", () => import("@/components/sections/who"));
const Services = named("Services", () => import("@/components/sections/services"));
const HowItWorks = named("HowItWorks", () => import("@/components/sections/how"));
const QualityGuardrails = named("QualityGuardrails", () => import("@/components/sections/quality"));
const Work = named("Work", () => import("@/components/sections/work"));
const Testimonials = named("Testimonials", () => import("@/components/sections/testimonials"));
const Pricing = named("Pricing", () => import("@/components/sections/pricing"));
const FAQ = named("FAQ", () => import("@/components/sections/faq"));
const ContactCTA = named("ContactCTA", () => import("@/components/sections/contact"));
const Toaster = named("Toaster", () => import("@/components/ui/sonner"));

/* Reserves roughly the section's height so a client-only render (or a slow
   chunk) never shifts the page. */
function Placeholder({ h }: { h: number }) {
  return <div aria-hidden="true" style={{ minHeight: h }} />;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GivenTake Devs | Your On-Demand Development Team" },
      {
        name: "description",
        content:
          "AI-native development studio for small businesses, founders, and growing teams. Websites, apps, agentic workflows, and internal tools — built with human review.",
      },
      { property: "og:title", content: "GivenTake Devs | Your On-Demand Development Team" },
      {
        property: "og:description",
        content:
          "AI-native development studio for small businesses, founders, and growing teams. Websites, apps, agentic workflows, and internal tools — built with human review.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/` },
      { property: "og:site_name", content: "GivenTake Devs" },
      { property: "og:image", content: ogImageUrl },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "GivenTake Devs — Your On-Demand Development Team",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "GivenTake Devs | Your On-Demand Development Team" },
      {
        name: "twitter:description",
        content:
          "AI-native development studio for small businesses, founders, and growing teams. Websites, apps, agentic workflows, and internal tools — built with human review.",
      },
      { name: "twitter:image", content: ogImageUrl },
      {
        name: "twitter:image:alt",
        content: "GivenTake Devs — Your On-Demand Development Team",
      },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/` }],
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
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />
      <main>
        <Hero />
        <TrustedPartner />
        <Suspense fallback={<Placeholder h={520} />}>
          <WhoWeHelp />
          <Services />
          <HowItWorks />
          <QualityGuardrails />
          <Work />
          <Testimonials />
          <Pricing />
          <FAQ />
          <ContactCTA />
        </Suspense>
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
    </div>
  );
}
