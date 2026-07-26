import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowUpRight } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background text-[11px] font-bold">
            GT
          </div>
          <span className="text-sm font-semibold tracking-tight">GivenTake Goods</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#services" className="text-sm text-muted-foreground transition hover:text-foreground">Services</a>
          <a href="#who" className="text-sm text-muted-foreground transition hover:text-foreground">Who we help</a>
          <a href="#work" className="text-sm text-muted-foreground transition hover:text-foreground">Work</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="rounded-full">
            <a href="#contact">
              Book a call <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-foreground text-background text-[10px] font-bold">GT</div>
          <span className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} GivenTake Goods Devs
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Your on-demand development team.</p>
        <a href="#contact" className="group inline-flex items-center gap-1 text-sm font-medium">
          Start a project
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>
    </footer>
  );
}
