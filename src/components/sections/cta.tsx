import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section id="contact" className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 aurora h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--brand),transparent_70%)] opacity-20 blur-3xl" />
      </div>
      <div className="mx-auto max-w-4xl px-6 py-24 text-center md:py-32">
        <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          Have an idea? Let's build it this quarter.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          A 30-minute call. We'll map what to build, how long it takes, and what it costs. No pitch decks.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-11 rounded-full px-6 text-sm">
            <a href="mailto:hello@giventake.dev">
              Book free strategy call
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </a>
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-11 rounded-full px-6 text-sm">
            <a href="#work">View our work</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
