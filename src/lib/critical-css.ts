/**
 * Critical, above-the-fold CSS inlined into the document head.
 *
 * The main stylesheet is loaded non-blocking, so this block is what paints the
 * header and hero on the very first frame. It intentionally covers only what is
 * visible above the fold and is keyed on `data-crit` hooks so it stays stable
 * regardless of utility-class churn in the components.
 */
export const criticalCss = `
@font-face{font-family:"Inter Tight";font-style:normal;font-weight:300 800;font-display:swap;src:url("/__l5e/assets-v1/95d1fcbb-84a4-490f-9fb7-fc4940056c0d/inter-tight-latin.woff2") format("woff2")}
@font-face{font-family:"Inter Tight Fallback";src:local("Arial"),local("Helvetica Neue"),local("Liberation Sans"),local("Roboto"),local("DejaVu Sans");size-adjust:97%;ascent-override:96%;descent-override:24%;line-gap-override:0%}
:root{--crit-ink:#0a0a0a;--crit-paper:#f7f7f5;--crit-hairline:#eaeaea;--crit-muted:#565656}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--crit-paper);color:var(--crit-ink);font-family:"Inter Tight","Inter Tight Fallback",ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
[data-crit] a:not([class]){color:inherit;text-decoration:none}
[data-crit="header"]{position:sticky;top:0;z-index:50;border-bottom:1px solid var(--crit-hairline);background:color-mix(in srgb,var(--crit-paper) 80%,transparent);backdrop-filter:blur(20px)}
[data-crit="header-inner"]{display:flex;height:64px;max-width:80rem;margin:0 auto;padding:0 24px;align-items:center;justify-content:space-between}
[data-crit="hero"]{position:relative;overflow:hidden;border-bottom:1px solid var(--crit-hairline)}
[data-crit="hero-grid"]{display:grid;grid-template-columns:1fr;gap:40px;max-width:80rem;margin:0 auto;padding:64px 24px 96px}
[data-crit="hero-left"]{display:flex;flex-direction:column;justify-content:center}
[data-crit="hero-title"]{margin:0;font-size:44px;font-weight:500;line-height:.98;letter-spacing:-.035em;color:var(--crit-ink)}
[data-crit="hero-lede"]{margin:32px 0 0;max-width:36rem;font-size:17px;line-height:1.55;color:var(--crit-muted)}
@media(min-width:640px){[data-crit="hero-title"]{font-size:56px}}
@media(min-width:768px){[data-crit="hero-grid"]{padding:96px 24px 128px}[data-crit="hero-title"]{font-size:72px}}
@media(min-width:1024px){[data-crit="hero-grid"]{grid-template-columns:1.15fr 1fr;gap:64px}[data-crit="hero-title"]{font-size:80px}}
`;
