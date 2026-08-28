/**
 * Critical, above-the-fold CSS inlined into the document head.
 *
 * The main stylesheet is loaded non-blocking, so this block is what paints the
 * header and hero on the very first frame. It intentionally covers only what is
 * visible above the fold and is keyed on `data-crit` hooks so it stays stable
 * regardless of utility-class churn in the components.
 */
export const criticalCss = `
@font-face{font-family:"Inter Tight";font-style:normal;font-weight:300 800;font-display:swap;src:url("/fonts/inter-tight-latin.woff2") format("woff2")}
@font-face{font-family:"Inter Tight Fallback";src:local("Arial"),local("Helvetica Neue"),local("Liberation Sans"),local("Roboto"),local("DejaVu Sans");size-adjust:97%;ascent-override:96%;descent-override:24%;line-gap-override:0%}
:root{--crit-ink:#0a0a0a;--crit-paper:#f7f7f5;--crit-hairline:#eaeaea;--crit-muted:#565656}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background-color:var(--crit-paper);color:var(--crit-ink);font-family:"Inter Tight","Inter Tight Fallback",ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
[data-crit] a:not([class]){color:inherit;text-decoration:none}
[data-crit="header"]{position:sticky;top:0;z-index:50;border-bottom:1px solid var(--crit-hairline);background:color-mix(in srgb,var(--crit-paper) 80%,transparent);backdrop-filter:blur(20px)}
[data-crit="header-inner"]{display:flex;height:64px;max-width:80rem;margin:0 auto;padding:0 24px;align-items:center;justify-content:space-between}
[data-crit="hero"]{position:relative;overflow:hidden;border-bottom:1px solid rgba(255,255,255,.1);background:radial-gradient(125% 90% at 50% -12%,#12142e 0%,#080912 55%,#06070d 100%)}
[data-crit="hero-grid"]{display:grid;grid-template-columns:1fr;gap:40px;max-width:80rem;margin:0 auto;padding:64px 24px 96px}
[data-crit="hero-left"]{display:flex;flex-direction:column;justify-content:center}
[data-crit="hero-title"]{margin:0;font-size:44px;font-weight:500;line-height:.98;letter-spacing:-.035em;color:#f5f6fb}
[data-crit="hero-lede"]{margin:32px 0 0;max-width:36rem;font-size:17px;line-height:1.55;color:rgba(255,255,255,.62)}
/* Everything else above the fold gets its final box now, so promoting the main
   stylesheet is a paint-only change and never reflows the hero. */
[data-crit="hero-badge"]{display:inline-flex;width:fit-content;align-items:center;gap:8px;margin:0 0 24px;padding:6px 12px;border:1px solid rgba(255,255,255,.15);border-radius:9999px;background:rgba(255,255,255,.05);font-size:12px;font-weight:500;line-height:1.4;color:rgba(255,255,255,.7)}
[data-crit="hero-cta"]{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:40px}
[data-crit="hero-cta-primary"],[data-crit="hero-cta-secondary"]{display:inline-flex;align-items:center;gap:8px;border-radius:9999px;font-size:14px;font-weight:500;line-height:1.4}
[data-crit="hero-cta-primary"]{padding:14px 24px;background:linear-gradient(120deg,#6d5cff,#4f46e5 55%,#22d3ee);color:#fff}
[data-crit="hero-cta-secondary"]{padding:14px 20px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff}
[data-crit="hero-cta"] svg{width:16px;height:16px}
[data-crit="hero-note"]{display:flex;align-items:flex-start;gap:12px;margin-top:48px;padding-top:24px;border-top:1px solid rgba(255,255,255,.1)}
[data-crit="hero-note"] span{margin-top:6px;flex:0 0 auto;width:8px;height:8px;border-radius:9999px}
[data-crit="hero-note"] p{margin:0;font-size:13px;line-height:1.55;color:rgba(255,255,255,.55)}
@media(min-width:640px){[data-crit="hero-title"]{font-size:56px}}
@media(min-width:768px){[data-crit="hero-grid"]{padding:96px 24px 128px}[data-crit="hero-title"]{font-size:72px}}
/* Reserve the hero media panel's box so promoting the main stylesheet does not
   resize the hero. The panel is a 4:5 frame that paints dark immediately; its
   inner showreel/placeholder fills in on promote without reflowing the box. */
[data-crit="hero-right"]{position:relative;display:flex;align-items:center;justify-content:center}
[data-crit="hero-signature"]{width:100%;max-width:520px}
[data-crit="hero-signature"]>div{aspect-ratio:4/5;width:100%;border-radius:1.25rem;border:1px solid rgba(255,255,255,.12);background:linear-gradient(160deg,#0e1022,#070812)}
@media(min-width:1024px){[data-crit="hero-grid"]{grid-template-columns:1.15fr 1fr;gap:64px}[data-crit="hero-title"]{font-size:80px}[data-crit="hero-right"]{justify-content:flex-end}}
/* Entrance + ambient motion declared up front: the first painted frame already
   has the final rules, so promoting the main stylesheet never re-triggers or
   flashes hero content. Ambient loops stay paused until <html data-motion="on">. */
@keyframes rise-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.rise-in{animation:rise-in .7s cubic-bezier(.22,1,.36,1) backwards;will-change:opacity,transform}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.85)}}
.pulse-dot{animation:pulse-dot 2s ease-in-out infinite;animation-play-state:paused}
:root[data-motion="on"] .pulse-dot{animation-play-state:running}
@media(prefers-reduced-motion:reduce){.rise-in{animation:none;opacity:1;transform:none}.pulse-dot{animation:none}}

`;
