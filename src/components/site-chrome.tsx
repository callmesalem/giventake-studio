import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogoMark, IconMenu, IconClose } from "@/components/marks";
import { useConsent } from "@/lib/use-consent";
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
  { label: "Work", href: "/work" },
  { label: "Process", href: "/process" },
  { label: "Guardrails", href: "/guardrails" },
  { label: "Pricing", href: "/pricing" },
  { label: "Careers", href: "/careers" },
];

/** Links shown only in the mobile panel, where there's room for more. */
const navMobileExtra = [
  { label: "How we use AI", href: "/how-we-use-ai" },
  { label: "Articles", href: "/articles" },
  { label: "FAQ", href: "/pricing#faq" },
];

/**
 * Mobile navigation.
 *
 * Until this existed the header was `hidden md:flex`, so below 768px there was
 * no navigation at all — on a phone the site's twelve pages were reachable only
 * from the footer.
 *
 * Built as a disclosure rather than a modal dialog: it's a menu, not a task that
 * needs interrupting for. That keeps the semantics simple and honest —
 * aria-expanded on the trigger, aria-controls pointing at the panel, Escape to
 * close with focus returned to the trigger, and closing on navigation. No focus
 * trap, because the panel doesn't claim the whole screen.
 */
function MobileNav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-white text-ink transition hover:border-ink"
      >
        {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 top-16 border-b border-hairline bg-paper shadow-lift"
        >
          <nav aria-label="Main" className="mx-auto max-w-7xl px-6 py-4">
            <ul className="divide-y divide-hairline">
              {[...nav, ...navMobileExtra].map((n) => (
                <li key={n.label}>
                  <a
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-[48px] items-center text-[16px] font-medium text-ink"
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href="/#contact"
              onClick={() => setOpen(false)}
              className="mt-4 flex min-h-[48px] items-center justify-center rounded-full bg-ink px-6 text-[14px] font-medium text-white"
            >
              Book a call
            </a>
          </nav>
        </div>
      )}
    </div>
  );
}

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

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
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
          {/* Stays visible at every width — it's the primary CTA, and hiding it
              behind the menu on phones would cost conversions on the majority
              of traffic. "Book a call" is the one that collapses. */}
          <a
            href="/#contact"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-90"
          >
            Start a project
          </a>
          <MobileNav />
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
        { label: "Work", href: "/work" },
        { label: "Pricing", href: "/pricing" },
        { label: "Our process", href: "/process" },
        { label: "How we use AI", href: "/how-we-use-ai" },
        { label: "Articles", href: "/articles" },
        { label: "Guardrails", href: "/guardrails" },
        { label: "FAQ", href: "/pricing#faq" },
      ],
    },
    {
      title: "Company",
      items: [
        { label: "Contact", href: "/#contact" },
        { label: "Careers", href: "/careers" },
        { label: "Privacy", href: "/privacy" },
        { label: "Compliance", href: "/compliance" },
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
              Booking projects for {new Date().getFullYear()}
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
            © {new Date().getFullYear()} GivenTake Devs. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted-ink">
            <a href="/privacy" className="hover:text-ink">
              Privacy
            </a>
            <a href="/compliance" className="hover:text-ink">
              Compliance
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
