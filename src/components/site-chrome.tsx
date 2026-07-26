import { Link } from "@tanstack/react-router";
import { AmpersandMark } from "@/components/marks";

const nav = [
  { label: "Services", href: "#services" },
  { label: "Work", href: "#work" },
  { label: "Ledger", href: "#how" },
  { label: "Pricing", href: "#pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <AmpersandMark className="h-6 w-6 text-ink" />
          <span className="font-display text-[17px] font-normal tracking-tight text-ink">
            GivenTake <span className="italic">Goods</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <a
              key={n.label}
              href={n.href}
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/70 transition hover:text-copper"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <a
          href="#contact"
          className="border border-ink bg-ink px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-paper transition hover:bg-copper hover:border-copper"
        >
          Book a call
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-ink bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <AmpersandMark className="h-7 w-7 text-paper" />
              <span className="font-display text-2xl tracking-tight">
                GivenTake <span className="italic">Goods</span> Devs
              </span>
            </div>
            <p className="mt-5 max-w-sm font-display text-xl italic leading-snug text-paper/70">
              You give us the intent. We give back the working software.
            </p>
            <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.22em] text-paper/50">
              Booking projects for {new Date().getFullYear()}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {[
              {
                title: "Services",
                items: ["Websites", "Web Apps", "AI", "Automation"],
              },
              {
                title: "Studio",
                items: ["Work", "About", "Contact", "FAQ"],
              },
              {
                title: "Elsewhere",
                items: ["Twitter", "LinkedIn", "GitHub", "Email"],
              },
            ].map((g) => (
              <div key={g.title}>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/50">
                  {g.title}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {g.items.map((i) => (
                    <li key={i}>
                      <a href="#" className="font-display text-lg text-paper transition hover:text-copper">
                        {i}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-paper/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/50">
            © {new Date().getFullYear()} GivenTake Goods Devs · All rights reserved
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/50">
            Set in Fraunces &amp; Instrument Sans · Printed on the web
          </p>
        </div>
      </div>
    </footer>
  );
}
