import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Hero } from "@/components/sections/hero";
import { TrustedPartner } from "@/components/sections/trusted";
import { WhoWeHelp } from "@/components/sections/who";
import { Services } from "@/components/sections/services";
import { HowItWorks } from "@/components/sections/how";
import { QualityGuardrails } from "@/components/sections/quality";
import { Work } from "@/components/sections/work";
import { Testimonials } from "@/components/sections/testimonials";
import { Pricing } from "@/components/sections/pricing";
import { FAQ, faqs } from "@/components/sections/faq";
import { ContactCTA } from "@/components/sections/contact";

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
        <WhoWeHelp />
        <Services />
        <section id="how"><HowItWorks /></section>
        <QualityGuardrails />
        <Work />
        <Testimonials />
        <Pricing />
        <section id="faq"><FAQ /></section>
        <ContactCTA />
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}
