/**
 * The Exchange — GivenTake's brand signature.
 *
 * A woven SVG "loom" where inputs on the left (idea, brief, problem, deadline)
 * are threaded through a central ampersand-shaped knot and emerge on the right
 * as outputs (product, system, launch, growth). Threads animate continuously;
 * hovering a label brightens its specific thread end-to-end.
 */

import { useState } from "react";

type Row = { id: string; give: string; take: string; color: string };

const ROWS: Row[] = [
  { id: "r1", give: "an idea",       take: "a product",  color: "var(--violet)" },
  { id: "r2", give: "a brief",       take: "a system",   color: "#0ea5e9" },
  { id: "r3", give: "a problem",     take: "a fix",      color: "#f59e0b" },
  { id: "r4", give: "a deadline",    take: "a launch",   color: "#10b981" },
];

export function BrandSignature() {
  const [hovered, setHovered] = useState<string | null>(null);

  // Canvas: 520 wide x 560 tall. Left labels at x=16, right at x=504.
  // Threads originate near x=110 and terminate near x=410, weaving through
  // the ampersand loom in the center (x≈260).
  const yFor = (i: number) => 90 + i * 110;

  return (
    <div className="relative isolate">
      {/* Frame */}
      <div className="relative overflow-hidden rounded-3xl border border-hairline bg-white shadow-lift">
        {/* Corner marks — hand-drafted feel */}
        <div className="pointer-events-none absolute inset-0">
          <span className="absolute left-4 top-4 h-3 w-3 border-l border-t border-ink/40" />
          <span className="absolute right-4 top-4 h-3 w-3 border-r border-t border-ink/40" />
          <span className="absolute bottom-4 left-4 h-3 w-3 border-b border-l border-ink/40" />
          <span className="absolute bottom-4 right-4 h-3 w-3 border-b border-r border-ink/40" />
        </div>

        {/* Column headers */}
        <div className="absolute left-6 top-6 z-10 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-ink">
          Given
        </div>
        <div className="absolute right-6 top-6 z-10 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-ink">
          Taken
        </div>

        <svg
          viewBox="0 0 520 560"
          className="block h-auto w-full"
          role="img"
          aria-label="The Exchange: inputs woven through a loom into outcomes."
        >
          <defs>
            {/* soft radial glow for the loom center */}
            <radialGradient id="loomGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--violet)" stopOpacity="0.18" />
              <stop offset="70%" stopColor="var(--violet)" stopOpacity="0" />
            </radialGradient>
            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
            {/* Dotted background inside the frame */}
            <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="var(--ink)" fillOpacity="0.06" />
            </pattern>
          </defs>

          <rect width="520" height="560" fill="url(#dots)" />
          <circle cx="260" cy="280" r="180" fill="url(#loomGlow)" />

          {/* Threads */}
          {ROWS.map((row, i) => {
            const y = yFor(i);
            const isHot = hovered === row.id;
            // Bezier from left label out, through the loom center at (260,280), to right label.
            const d = `
              M 110 ${y}
              C 170 ${y}, 200 ${280 + (y - 280) * 0.15}, 260 280
              C 320 ${280 - (y - 280) * 0.15}, 350 ${y}, 410 ${y}
            `;
            return (
              <g key={row.id}>
                {/* base thread */}
                <path
                  d={d}
                  fill="none"
                  stroke={row.color}
                  strokeOpacity={isHot ? 0.95 : hovered ? 0.12 : 0.35}
                  strokeWidth={isHot ? 2 : 1.25}
                  strokeLinecap="round"
                  style={{ transition: "stroke-opacity 300ms, stroke-width 300ms" }}
                />
                {/* animated shuttle running along the thread */}
                <circle r={isHot ? 3.5 : 2.5} fill={row.color}>
                  <animateMotion
                    dur={`${6 + i * 0.7}s`}
                    repeatCount="indefinite"
                    path={d}
                    rotate="auto"
                  />
                </circle>
              </g>
            );
          })}

          {/* The Loom — a woven ampersand, the studio monogram */}
          <g transform="translate(260 280)" filter="url(#soft)">
            {/* outer ring */}
            <circle r="52" fill="none" stroke="var(--ink)" strokeOpacity="0.12" strokeWidth="1" />
            <circle r="42" fill="white" stroke="var(--ink)" strokeOpacity="0.9" strokeWidth="1.25" />
            {/* Custom ampersand — drawn as two interlocked loops (give & take) */}
            <path
              d="M -14 -14 C -22 -6, -22 8, -12 14 C -2 20, 10 14, 14 4 M 14 4 C 18 -4, 12 -14, 2 -14 C -8 -14, -14 -6, -10 2 L 20 22"
              fill="none"
              stroke="var(--ink)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* tick marks around the ring */}
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * Math.PI * 2;
              const x1 = Math.cos(a) * 46;
              const y1 = Math.sin(a) * 46;
              const x2 = Math.cos(a) * 50;
              const y2 = Math.sin(a) * 50;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="var(--ink)"
                  strokeOpacity="0.35"
                  strokeWidth="1"
                />
              );
            })}
          </g>

          {/* Column rules */}
          <line x1="104" y1="60" x2="104" y2="500" stroke="var(--ink)" strokeOpacity="0.08" />
          <line x1="416" y1="60" x2="416" y2="500" stroke="var(--ink)" strokeOpacity="0.08" />

          {/* Baseline label */}
          <text
            x="260"
            y="536"
            textAnchor="middle"
            className="fill-muted-ink"
            style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}
          >
            The Exchange · No. 001
          </text>
        </svg>

        {/* Interactive labels layered over SVG */}
        <div className="pointer-events-none absolute inset-0">
          {ROWS.map((row, i) => {
            const y = yFor(i);
            const top = `${(y / 560) * 100}%`;
            const isHot = hovered === row.id;
            return (
              <div key={row.id}>
                {/* left: given */}
                <button
                  type="button"
                  onMouseEnter={() => setHovered(row.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(row.id)}
                  onBlur={() => setHovered(null)}
                  className="pointer-events-auto absolute -translate-y-1/2 rounded-full border bg-white px-3 py-1.5 text-[12px] font-medium transition"
                  style={{
                    left: "3.5%",
                    top,
                    borderColor: isHot ? row.color : "var(--hairline)",
                    color: isHot ? row.color : "var(--ink)",
                    boxShadow: isHot ? `0 4px 14px -6px ${row.color}` : undefined,
                  }}
                >
                  {row.give}
                </button>

                {/* right: taken */}
                <button
                  type="button"
                  onMouseEnter={() => setHovered(row.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(row.id)}
                  onBlur={() => setHovered(null)}
                  className="pointer-events-auto absolute -translate-y-1/2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition"
                  style={{
                    right: "3.5%",
                    top,
                    borderColor: isHot ? row.color : "var(--ink)",
                    background: isHot ? row.color : "var(--ink)",
                    color: "#fff",
                  }}
                >
                  {row.take}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Caption plate */}
      <div className="mt-4 flex items-center justify-between px-1 text-[11px] text-muted-ink">
        <span className="font-mono uppercase tracking-[0.18em]">Give &amp; take, on repeat</span>
        <span className="font-mono">GT—∞</span>
      </div>
    </div>
  );
}
