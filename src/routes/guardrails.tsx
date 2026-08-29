import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { QualityGuardrails } from "@/components/sections/quality";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/guardrails")({
  head: () =>
    pageHead({
      path: "/guardrails",
      title: "Quality & Guardrails · How We Keep AI Reliable · GivenTake Devs",
      description:
        "AI speeds up the work; these guardrails keep it reliable. Every AI-generated line is verified, automated tests run before review, security is built in, and a human signs off at every gate.",
    }),
  component: GuardrailsPage,
});

function GuardrailsPage() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />
      <main>
        <QualityGuardrails />
      </main>
      <SiteFooter />
    </div>
  );
}
