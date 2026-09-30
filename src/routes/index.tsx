import { lazy, Suspense, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Hero } from "@/components/sections/hero";
import { TrustedPartner } from "@/components/sections/trusted";
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
const Testimonials = named("Testimonials", () => import("@/components/sections/testimonials"));
const SiteCheck = named("SiteCheck", () => import("@/components/sections/site-check"));
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
      { title: "GivenTake Devs | Websites That Report Back" },
      {
        name: "description",
        content:
          "A one-person web studio in Ohio. Websites for small businesses on one flat monthly price: design, hosting, updates, and a plain-English report every quarter showing what's bringing you customers.",
      },
      { property: "og:title", content: "GivenTake Devs | Websites That Report Back" },
      {
        property: "og:description",
        content:
          "A one-person web studio in Ohio. Websites for small businesses on one flat monthly price: design, hosting, updates, and a plain-English report every quarter showing what's bringing you customers.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/` },
      { property: "og:site_name", content: "GivenTake Devs" },
      ...(ogImageUrl ? [{ property: "og:image", content: ogImageUrl }] : []),
      ...(ogImageUrl
        ? [
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
          ]
        : []),
      ...(ogImageUrl
        ? [
            {
              property: "og:image:alt",
              content: "GivenTake Devs, Websites That Report Back",
            },
          ]
        : []),
      {
        name: "twitter:card",
        content: ogImageUrl ? "summary_large_image" : "summary",
      },
      { name: "twitter:title", content: "GivenTake Devs | Websites That Report Back" },
      {
        name: "twitter:description",
        content:
          "A one-person web studio in Ohio. Websites for small businesses on one flat monthly price: design, hosting, updates, and a plain-English report every quarter showing what's bringing you customers.",
      },
      ...(ogImageUrl ? [{ name: "twitter:image", content: ogImageUrl }] : []),
      ...(ogImageUrl
        ? [
            {
              name: "twitter:image:alt",
              content: "GivenTake Devs, Websites That Report Back",
            },
          ]
        : []),
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/` }],
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
          <Testimonials />
          <SiteCheck />
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
