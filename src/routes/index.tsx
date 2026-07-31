import { lazy, Suspense, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Hero } from "@/components/sections/hero";
import { TrustedPartner } from "@/components/sections/trusted";
import { faqs } from "@/lib/faq-data";

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
      { title: "GivenTake Goods Devs | AI-Native Development Team for Hire" },
      {
        name: "description",
        content:
          "AI-native development studio building websites, apps, internal tools, and agentic workflows for small businesses and founders. One developer, AI-assisted delivery.",
      },
      { property: "og:title", content: "GivenTake Goods Devs | AI-Native Development Team for Hire" },
      {
        property: "og:description",
        content:
          "AI-native development studio building websites, apps, internal tools, and agentic workflows for small businesses and founders. One developer, AI-assisted delivery.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://dev-on-demand-hub.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://dev-on-demand-hub.lovable.app/" }],
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
    <div className="min-h-screen bg-background text-foreground antialiased">
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
      <Suspense fallback={null}><Toaster /></Suspense>
    </div>
  );
}
