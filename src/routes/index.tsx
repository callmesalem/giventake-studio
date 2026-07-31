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
import { FAQ } from "@/components/sections/faq";
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
      { name: "twitter:card", content: "summary_large_image" },
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
