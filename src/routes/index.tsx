import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Hero } from "@/components/sections/hero";
import { TrustedPartner } from "@/components/sections/trusted";
import { WhoWeHelp } from "@/components/sections/who";
import { Services } from "@/components/sections/services";
import { CTA } from "@/components/sections/cta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GivenTake Goods Devs — Your On-Demand Development Team" },
      {
        name: "description",
        content:
          "We build websites, apps, AI tools, automations, and business systems for small businesses, founders, and growing companies. No coding, no hiring.",
      },
      { property: "og:title", content: "GivenTake Goods Devs — Your On-Demand Development Team" },
      {
        property: "og:description",
        content:
          "Websites, apps, AI, and automations built by a senior team — without hiring engineers.",
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
        <CTA />
      </main>
      <SiteFooter />
    </div>
  );
}
