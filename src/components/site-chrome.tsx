import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Twitter, Linkedin, Github } from "lucide-react";

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
          <a href="#work" className="text-sm text-muted-foreground transition hover:text-foreground">Portfolio</a>
          <a href="#pricing" className="text-sm text-muted-foreground transition hover:text-foreground">Pricing</a>
          <a href="#who" className="text-sm text-muted-foreground transition hover:text-foreground">About</a>
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
  const groups = [
    {
      title: "Services",
      links: [
        { label: "Website Development", href: "#services" },
        { label: "Web Applications", href: "#services" },
        { label: "AI Integrations", href: "#services" },
        { label: "Business Automation", href: "#services" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Portfolio", href: "#work" },
        { label: "About", href: "#who" },
        { label: "Pricing", href: "#pricing" },
        { label: "Contact", href: "#contact" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "How it works", href: "#how" },
        { label: "FAQ", href: "#faq" },
        { label: "Book a call", href: "#contact" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_2fr]">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background text-[11px] font-bold">
                GT
              </div>
              <span className="text-sm font-semibold tracking-tight">GivenTake Goods Devs</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Your on-demand development team for websites, apps, AI, and automations without hiring.
            </p>
            <div className="mt-6 flex items-center gap-2">
              {[
                { icon: Twitter, label: "Twitter" },
                { icon: Linkedin, label: "LinkedIn" },
                { icon: Github, label: "GitHub" },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="grid h-9 w-9 place-items-center rounded-full border border-border/70 text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.6} />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {groups.map((g) => (
              <div key={g.title}>
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                  {g.title}
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {g.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-sm text-muted-foreground transition hover:text-foreground"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 md:flex-row md:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} GivenTake Goods Devs. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">Your on-demand development team.</p>
        </div>
      </div>
    </footer>
  );
}
