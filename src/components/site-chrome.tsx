import { Link } from "@tanstack/react-router";
import { LogoMark } from "@/components/marks";

const nav = [
  { label: "Services", href: "#services" },
  { label: "Work", href: "#work" },
  { label: "How", href: "#how" },
  { label: "Pricing", href: "#pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7 text-ink" />
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            GivenTake<span className="text-muted-ink">·</span>Devs
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <a
              key={n.label}
              href={n.href}
              className="text-sm font-medium text-muted-ink transition hover:text-ink"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#contact"
            className="hidden text-sm font-medium text-muted-ink transition hover:text-ink sm:inline-flex"
          >
            Book a call
          </a>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-90"
          >
            Start a project
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const groups = [
    {
      title: "Services",
      items: [
        { label: "Websites", href: "#services" },
        { label: "Web Apps", href: "#services" },
        { label: "AI Integrations", href: "#services" },
        { label: "Automation", href: "#services" },
      ],
    },
    {
      title: "Studio",
      items: [
        { label: "Work", href: "#work" },
        { label: "Pricing", href: "#pricing" },
        { label: "How it works", href: "#how" },
        { label: "FAQ", href: "#faq" },
      ],
    },
    {
      title: "Company",
      items: [
        { label: "Contact", href: "#contact" },
        { label: "About", href: "#" },
        { label: "Privacy", href: "#" },
        { label: "Terms", href: "#" },
      ],
    },
  ];

  return (
    <footer className="border-t border-hairline bg-paper">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark className="h-7 w-7 text-ink" />
              <span className="text-[15px] font-semibold tracking-tight text-ink">
                GivenTake·Devs
              </span>
            </div>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted-ink">
              Your on-demand development team. We build software for businesses that would rather ship than hire.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-3 py-1.5 text-[12px] font-medium text-muted-ink">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 pulse-dot" />
              </span>
              Booking projects for {new Date().getFullYear() + 1}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-ink">
                  {g.title}
                </p>
                <ul className="mt-4 space-y-3">
                  {g.items.map((i) => (
                    <li key={i.label}>
                      <a
                        href={i.href}
                        className="text-[14px] text-muted-ink transition hover:text-ink"
                      >
                        {i.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-muted-ink">
            © {new Date().getFullYear()} GivenTake Goods Devs. All rights reserved.
          </p>
          <p className="text-[12px] text-muted-ink">
            Built by hand, shipped weekly.
          </p>
        </div>
      </div>
    </footer>
  );
}
