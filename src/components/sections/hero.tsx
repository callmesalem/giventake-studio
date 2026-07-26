import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      {/* animated aurora background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid bg-radial-fade opacity-60" />
        <div className="absolute left-1/2 top-[-20%] aurora h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--brand),transparent_70%)] opacity-30 blur-3xl" />
        <div className="absolute right-[-10%] top-[10%] aurora h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,oklch(0.7_0.18_190),transparent_70%)] opacity-20 blur-3xl [animation-delay:-6s]" />
      </div>

      <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-32 md:pb-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-brand" />
            Your on-demand development team
          </div>

          <h1 className="text-gradient-brand text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Stop looking for developers.
            <br />
            <span className="text-foreground">Start building.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
            We build websites, apps, AI tools, automations, and business systems for the people running the business. No coding, no hiring, no technical headaches.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 rounded-full px-6 text-sm font-medium">
              <a href="#contact">
                Book free strategy call
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-11 rounded-full px-6 text-sm font-medium">
              <a href="#work">View our work</a>
            </Button>
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            Trusted by founders and operators shipping without an engineering team.
          </p>
        </div>
      </div>
    </section>
  );
}
