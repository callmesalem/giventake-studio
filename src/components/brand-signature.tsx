/**
 * The Exchange — GivenTake's brand signature.
 *
 * A woven SVG "loom": inputs on the left (idea, brief, problem, deadline)
 * are threaded through a central ampersand monogram and emerge on the right
 * as outcomes (product, system, fix, launch). Each row is a link to the
 * matching section. Fully keyboard accessible, dark-mode aware, and
 * responsive: threads animate on desktop, static + subtle on reduced motion.
 */

import { useEffect, useState } from "react";

type Row = {
  id: string;
  give: string;
  take: string;
  color: string; // light-mode thread
  colorDark: string; // dark-mode thread
  href: string;
  label: string; // aria description of the whole exchange
};

const ROWS: Row[] = [
  {
    id: "r1",
    give: "an idea",
    take: "a product",
    color: "#4f46e5",
    colorDark: "#a5b4fc",
    href: "#services",
    label: "From an idea to a product — see our services",
  },
  {
    id: "r2",
    give: "a brief",
    take: "a system",
    color: "#0ea5e9",
    colorDark: "#7dd3fc",
    href: "#how",
    label: "From a brief to a system — see how we work",
  },
  {
    id: "r3",
    give: "a problem",
    take: "a fix",
    color: "#f59e0b",
    colorDark: "#fcd34d",
    href: "#work",
    label: "From a problem to a fix — see the kind of work we take",
  },
  {
    id: "r4",
    give: "a deadline",
    take: "a launch",
    color: "#10b981",
    colorDark: "#6ee7b7",
    href: "#contact",
    label: "From a deadline to a launch — start a project",
  },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains("dark"));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export function BrandSignature() {
  const [active, setActive] = useState<string | null>(null);
  const reduced = usePrefersReducedMotion();
  const dark = useIsDark();

  const yFor = (i: number) => 90 + i * 110;
  const threadColor = (r: Row) => (dark ? r.colorDark : r.color);

  const smoothScrollTo = (href: string) => {
    const el = document.querySelector(href);
    if (!el) return;
    el.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  };

  const handleActivate = (row: Row) => (e: React.MouseEvent | React.KeyboardEvent) => {
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    smoothScrollTo(row.href);
  };

  return (
    <div className="relative isolate">
      <div
        className="relative overflow-hidden rounded-3xl border border-hairline bg-card shadow-lift"
        role="group"
        aria-label="The Exchange: what we take in and what we ship."
      >
        {/* Corner marks */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="absolute left-4 top-4 h-3 w-3 border-l border-t border-foreground/40" />
          <span className="absolute right-4 top-4 h-3 w-3 border-r border-t border-foreground/40" />
          <span className="absolute bottom-4 left-4 h-3 w-3 border-b border-l border-foreground/40" />
          <span className="absolute bottom-4 right-4 h-3 w-3 border-b border-r border-foreground/40" />
        </div>

        <div
          aria-hidden="true"
          className="absolute left-6 top-6 z-10 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          Given
        </div>
        <div
          aria-hidden="true"
          className="absolute right-6 top-6 z-10 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          Taken
        </div>

        <svg
          viewBox="0 0 520 560"
          className="block h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <radialGradient id="loomGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={dark ? "#a5b4fc" : "#4f46e5"} stopOpacity="0.22" />
              <stop offset="70%" stopColor={dark ? "#a5b4fc" : "#4f46e5"} stopOpacity="0" />
            </radialGradient>
            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
            <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle
                cx="1"
                cy="1"
                r="1"
                fill="currentColor"
                className="text-foreground"
                fillOpacity={dark ? 0.09 : 0.06}
              />
            </pattern>
          </defs>

          <rect width="520" height="560" fill="url(#dots)" />
          <circle cx="260" cy="280" r="180" fill="url(#loomGlow)" />

          {ROWS.map((row, i) => {
            const y = yFor(i);
            const isHot = active === row.id;
            const dimmed = active && !isHot;
            const c = threadColor(row);
            const d = `
              M 110 ${y}
              C 170 ${y}, 200 ${280 + (y - 280) * 0.15}, 260 280
              C 320 ${280 - (y - 280) * 0.15}, 350 ${y}, 410 ${y}
            `;
            return (
              <g key={row.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={c}
                  strokeOpacity={isHot ? 0.95 : dimmed ? 0.1 : 0.4}
                  strokeWidth={isHot ? 2.25 : 1.4}
                  strokeLinecap="round"
                  style={{
                    transition:
                      "stroke-opacity 400ms cubic-bezier(0.22, 1, 0.36, 1), stroke-width 400ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                />
                {!reduced && (
                  <circle r={isHot ? 4 : 2.75} fill={c} opacity={dimmed ? 0.2 : 1}>
                    <animateMotion
                      dur={`${6 + i * 0.7}s`}
                      repeatCount="indefinite"
                      path={d}
                      rotate="auto"
                      begin={`${i * 0.3}s`}
                    />
                  </circle>
                )}
              </g>
            );
          })}

          {/* Ampersand loom */}
          <g transform="translate(260 280)" filter="url(#soft)">
            <circle r="52" fill="none" stroke="currentColor" className="text-foreground" strokeOpacity="0.14" strokeWidth="1" />
            <circle
              r="42"
              className="fill-card text-foreground"
              stroke="currentColor"
              strokeOpacity="0.9"
              strokeWidth="1.25"
            />
            <path
              d="M -14 -14 C -22 -6, -22 8, -12 14 C -2 20, 10 14, 14 4 M 14 4 C 18 -4, 12 -14, 2 -14 C -8 -14, -14 -6, -10 2 L 20 22"
              fill="none"
              stroke="currentColor"
              className="text-foreground"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                <line
                  key={i}
                  x1={Math.cos(a) * 46}
                  y1={Math.sin(a) * 46}
                  x2={Math.cos(a) * 50}
                  y2={Math.sin(a) * 50}
                  stroke="currentColor"
                  className="text-foreground"
                  strokeOpacity="0.4"
                  strokeWidth="1"
                />
              );
            })}
          </g>

          <line x1="104" y1="60" x2="104" y2="500" stroke="currentColor" className="text-foreground" strokeOpacity="0.09" />
          <line x1="416" y1="60" x2="416" y2="500" stroke="currentColor" className="text-foreground" strokeOpacity="0.09" />

          <text
            x="260"
            y="536"
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}
          >
            The Exchange · No. 001
          </text>
        </svg>

        {/* Interactive label layer */}
        <ul
          className="pointer-events-none absolute inset-0 m-0 list-none p-0"
          aria-label="Jump to a section by exchange"
        >
          {ROWS.map((row, i) => {
            const y = yFor(i);
            const top = `${(y / 560) * 100}%`;
            const isHot = active === row.id;
            const c = threadColor(row);
            return (
              <li key={row.id}>
                {/* Given (left) */}
                <a
                  href={row.href}
                  aria-label={row.label}
                  onMouseEnter={() => setActive(row.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(row.id)}
                  onBlur={() => setActive(null)}
                  onClick={handleActivate(row)}
                  onKeyDown={handleActivate(row)}
                  className="pointer-events-auto absolute inline-flex -translate-y-1/2 items-center rounded-full border bg-card px-2.5 py-1 text-[11px] font-medium outline-none transition-all duration-300 ease-out hover:-translate-y-[calc(50%+2px)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3 sm:py-1.5 sm:text-[12px]"
                  style={{
                    left: "3.5%",
                    top,
                    borderColor: isHot ? c : "var(--border)",
                    color: isHot ? c : "var(--foreground)",
                    boxShadow: isHot ? `0 6px 18px -6px ${c}` : undefined,
                    // @ts-expect-error CSS var for focus ring
                    "--tw-ring-color": c,
                  }}
                >
                  {row.give}
                </a>

                {/* Taken (right) */}
                <a
                  href={row.href}
                  aria-hidden="true"
                  tabIndex={-1}
                  onMouseEnter={() => setActive(row.id)}
                  onMouseLeave={() => setActive(null)}
                  onClick={handleActivate(row)}
                  className="pointer-events-auto absolute inline-flex -translate-y-1/2 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-300 ease-out hover:-translate-y-[calc(50%+2px)] sm:px-3 sm:py-1.5 sm:text-[12px]"
                  style={{
                    right: "3.5%",
                    top,
                    borderColor: isHot ? c : "var(--foreground)",
                    background: isHot ? c : "var(--foreground)",
                    color: "var(--background)",
                    boxShadow: isHot ? `0 6px 18px -6px ${c}` : undefined,
                  }}
                >
                  {row.take}
                  <span aria-hidden="true" className="ml-1 inline-block transition-transform duration-300 group-hover:translate-x-0.5">→</span>
                </a>

                {/* Row hitbox for the middle band — improves mobile tap area */}
                <a
                  href={row.href}
                  aria-hidden="true"
                  tabIndex={-1}
                  onMouseEnter={() => setActive(row.id)}
                  onMouseLeave={() => setActive(null)}
                  onClick={handleActivate(row)}
                  className="pointer-events-auto absolute left-[22%] right-[22%] block h-11 -translate-y-1/2"
                  style={{ top }}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <div
        aria-hidden="true"
        className="mt-4 flex items-center justify-between px-1 text-[11px] text-muted-foreground"
      >
        <span className="font-mono uppercase tracking-[0.18em]">Give &amp; take, on repeat</span>
        <span className="font-mono">GT—∞</span>
      </div>
    </div>
  );
}
