import { Link } from "@tanstack/react-router";
import { LogoMark } from "@/components/marks";
import { useConsent } from "@/lib/consent";
import { offers } from "@/lib/offers";

/**
 * Header and footer render on every route, so section links MUST be
 * root-relative ("/#pricing"), never a bare hash ("#pricing"). A bare hash only
 * resolves against the current document, so on /services/*, /privacy, /terms,
 * /cookies, /do-not-sell and /data-request it silently does nothing.
 */

function CookieSettingsLink() {
  const { openPreferences } = useConsent();
  return (
    <button
      type="button"
      data-consent-trigger="footer"
      onClick={openPreferences}
      className="hover:text-ink"
    >
      Cookie settings
    </button>
  );
}

const nav = [
  { label: "Services", href: "/services" },
  { label: "Work", href: "/#work" },
  { label: "Process", href: "/process" },
  { label: "Guardrails", href: "/#guardrails" },
  { label: "Pricing", href: "/#pricing" },
];

export function SiteHeader() {
  return (
    <header
      data-crit="header"
      className="sticky top-0 z-50 border-b border-hairline bg-paper/80 backdrop-blur-xl"
    >
      <div
        data-crit="header-inner"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6"
      >
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
              className="nav-link text-sm font-medium text-muted-ink transition hover:text-ink"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="/#contact"
            className="nav-link hidden text-sm font-medium text-muted-ink transition hover:text-ink sm:inline-flex"
          >
            Book a call
          </a>
          <a
            href="/#contact"
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
      // Real offer pages rather than four labels pointing at one homepage
      // anchor — these are the pages that most need internal links.
      title: "Services",
      items: [
        ...offers.map((o) => ({ label: o.title, href: `/services/${o.slug}` })),
        { label: "All services", href: "/services" },
      ],
    },
    {
      title: "Studio",
      items: [
        { label: "Work", href: "/#work" },
        { label: "Pricing", href: "/#pricing" },
        { label: "Our process", href: "/process" },
        { label: "How we use AI", href: "/how-we-use-ai" },
        { label: "Articles", href: "/articles" },
        { label: "Guardrails", href: "/#guardrails" },
        { label: "FAQ", href: "/#faq" },
      ],
    },
    {
      title: "Company",
      items: [
        { label: "Contact", href: "/#contact" },
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Cookies", href: "/cookies" },
        { label: "Data request", href: "/data-request" },
        { label: "Do Not Sell or Share", href: "/do-not-sell" },
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
              Your on-demand, AI-native development team. We build software for businesses that
              would rather ship than hire.
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
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted-ink">
            <a href="/privacy" className="hover:text-ink">
              Privacy
            </a>
            <a href="/terms" className="hover:text-ink">
              Terms
            </a>
            <a href="/cookies" className="hover:text-ink">
              Cookies
            </a>
            <a
              href="/do-not-sell"
              className="font-medium text-ink underline decoration-hairline underline-offset-4 hover:decoration-ink"
            >
              Do Not Sell or Share My Personal Information
            </a>
            <CookieSettingsLink />
          </div>
        </div>
      </div>
    </footer>
  );
}
