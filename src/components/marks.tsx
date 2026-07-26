import type { SVGProps } from "react";

/* GivenTake ampersand mark — hand-drawn feel, stroke-based */
export function AmpersandMark({ className = "", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} {...props}>
      <rect x="1" y="1" width="38" height="38" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <text
        x="50%"
        y="55%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="Fraunces, serif"
        fontStyle="italic"
        fontWeight="500"
        fontSize="26"
        fill="currentColor"
      >
        &amp;
      </text>
    </svg>
  );
}

/* Hand-drawn underline that scribes itself under a word */
export function ScribedUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 300 14"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M2 8 C 40 2, 90 12, 140 6 S 240 10, 298 4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="animate-underline"
      />
    </svg>
  );
}

/* Monoline glyphs — hand-drawn feel via stroke, no icon pack */
export function GlyphExchange({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M4 11h20l-4-4M28 21H8l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GlyphFrame({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="4" y="7" width="24" height="18" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 12h24M8 10.5v0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function GlyphStack({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 4 3 11l13 7 13-7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3 17l13 7 13-7M3 23l13 7 13-7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function GlyphSpark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 4v10M16 18v10M4 16h10M18 16h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function GlyphLoop({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M6 20a8 8 0 1 1 14 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M22 21l-2 4-4-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GlyphKey({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="10" cy="16" r="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M15 16h13M23 16v4M27 16v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function GlyphSprout({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 28V14M16 14c0-5 4-8 9-8-.5 5-4 8-9 8zM16 18c0-4-3-6-7-6 .5 4 3 6 7 6z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Arrow used inline in ledger rows */
export function ArrowRightThin({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 12" fill="none" className={className} aria-hidden>
      <path d="M0 6h22M17 1l5 5-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
