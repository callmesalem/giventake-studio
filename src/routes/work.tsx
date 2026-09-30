import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Work } from "@/components/sections/work";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/work")({
  head: () =>
    pageHead({
      path: "/work",
      title: "Work · What We Build · GivenTake Devs",
      description:
        "The kinds of software we take on: intake and routing, booking and payments, internal dashboards that replace spreadsheets, and rebuilt marketing sites. Every build gets human review.",
    }),
  component: WorkPage,
});

function WorkPage() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />
      <main>
        <Work />
      </main>
      <SiteFooter />
    </div>
  );
}
