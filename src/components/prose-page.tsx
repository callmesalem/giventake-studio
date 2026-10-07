import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { IconArrowRight } from "@/components/marks";

/**
 * Shared shell for long-form public pages (/process, /how-we-use-ai, articles).
 * Keeps typography and the closing CTA consistent so pages published later
 * don't drift from the ones published first.
 */
export function ProsePage({
  eyebrow,
  title,
  lede,
  meta,
  children,
  ctaTitle = "Start with a call.",
  ctaBody = "Thirty minutes, free, no obligation. You'll leave with a clear view of what your project would take, whether or not you work with us.",
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  /** Optional line under the lede — publish date, reading time. */
  meta?: string;
  children: ReactNode;
  ctaTitle?: string;
  ctaBody?: string;
}) {
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />

      <main>
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
            <p className="text-[13px] font-medium text-violet">{eyebrow}</p>
            <h1 className="mt-3 font-display text-[36px] font-medium leading-[1.05] tracking-[-0.03em] text-ink md:text-[48px]">
              {title}
            </h1>
            {lede && <p className="mt-5 text-[18px] leading-relaxed text-muted-ink">{lede}</p>}
            {meta && <p className="mt-5 text-[13px] text-muted-ink">{meta}</p>}
          </div>
        </section>

        <section className="border-b border-hairline">
          <div className="mx-auto max-w-3xl px-6 py-14">{children}</div>
        </section>

        <section className="border-b border-hairline bg-secondary/50">
          <div className="mx-auto max-w-3xl px-6 py-14 text-center">
            <h2 className="font-display text-3xl font-medium tracking-[-0.03em] text-ink">
              {ctaTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[16.5px] leading-relaxed text-muted-ink">
              {ctaBody}
            </p>
            <a
              href="/#contact"
              className="btn-icon-nudge mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14px] font-medium text-white transition hover:opacity-90"
            >
              Start a project
              <IconArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/** Section heading inside a ProsePage. */
export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-12 font-display text-[26px] font-medium tracking-[-0.02em] text-ink first:mt-0 md:text-3xl">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 text-[18px] font-semibold tracking-tight text-ink">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[16.5px] leading-[1.7] text-ink/85">{children}</p>;
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-5 space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-[16px] leading-relaxed text-ink/85">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Pulled-out emphasis block for the point that matters most in a section. */
export function Callout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mt-7 rounded-2xl border border-hairline bg-violet-soft/60 p-6">
      {title && (
        <p className="text-[12px] font-semibold uppercase tracking-wider text-violet">{title}</p>
      )}
      <div className="mt-1.5 text-[16px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}
