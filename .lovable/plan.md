## Direction

Retire the Trade Ledger editorial system entirely. Rebuild the landing page in the visual language of ocoya.com: light, airy, geometric, product-forward. The niche stays: a small dev team businesses hire instead of finding engineers themselves. The signature moment becomes floating mini product mockups on the right of the hero, showing the kinds of things we actually build.

## Design system

- **Palette:** near-white background `#F7F7F5` with subtle dotted grid, ink `#0A0A0A` for text/CTAs, one accent `#4F46E5` (indigo-violet) used sparingly for pills, "LIVE" dots, and hover states. Card surfaces pure white with a 1px `#EAEAEA` border and a very soft shadow. Muted text `#6B6B6B`.
- **Typography:** Geist Sans (or Inter Tight as fallback) for everything. Display sizes tight tracking, -0.03em, weight 500. Body 15–16px, weight 400, `#3A3A3A`. Drop Fraunces, JetBrains Mono, Instrument Sans, and all italic-serif emphasis.
- **Components:** rounded 14px cards, black pill CTAs with white text, ghost secondary "Watch intro ▷" style, small pill badges ("NEW", "LIVE" with a green dot), overlapping circular avatars for social proof.
- **Motion:** one considered scroll reveal — floating cards in the hero drift in on load and gently parallax on scroll. Nothing else animates on entrance. Hover states only on buttons and cards.
- **Icons:** simple geometric line icons at 1.5px stroke, custom-drawn (no Lucide). Roman numerals and № markers are gone.

## Signature moment

Split hero. Left column (60%): headline, subhead, two CTAs, overlapping client-logo circles + "LIVE · Booking projects for 2026". Right column (40%): a vertical stack of three floating mockup cards, each showing a real product surface we build, offset horizontally for a stacked feel:

1. **Booking calendar card** — a mini month grid with two slots highlighted, header "New booking · Confirmed", small avatar.
2. **Admin dashboard card** — a tiny bar chart, a row of KPI numbers (Jobs 24, Invoices 12, MRR $18.4k), a status pill.
3. **AI intake card** — an inbox row that's been auto-summarized: sender, one-line summary, tag pills ("Founder", "MVP", "Priority").

Cards use white surface, thin border, soft shadow, and a subtle drift animation (translateY 0 → -6px on 6s ease-in-out infinite alternate, staggered).

## Sections (all rebuilt)

```text
Nav          logo · Services Work How Pricing · [Book a call] pill
Hero         split · floating mockup stack · overlapping avatars · LIVE pill
Trusted      one row of 6 client-style logo pills (grayscale, low contrast)
Who we help  3 rounded cards, geometric icon, headline, 2-line body
Services     3-col grid of 7 items · icon top-left · title · one-line description
How it works 3 horizontal steps · number in a circle · connector line · card body
Work         2x2 grid of project cards with real UI screenshot placeholders + tech pills
Testimonials 3 cards · quote · avatar · name/role. Existing outcome-specific copy stays.
Pricing      3-tier cards, middle tier highlighted with indigo border + "Most picked" pill
FAQ          accordion, same 6 questions, existing conversational answers stay
Contact      split · left "Let's Build Something Great." + email/socials · right the form
Footer       minimal · logo · 4 nav columns · copyright · no social row
```

## Copy

Keep the existing plain-language, founder-voice copy across sections. Retire all Trade Ledger framing: no "№ 01 / Manifesto", no "Vol. 001", no "Given ↔ Taken" ledger pairs, no "Signed", no Roman numerals, no "The Roster / The Archive / The Answers" section titles. Section eyebrows become simple lowercase tags like "services" or "how it works" in the accent color.

Headline stays: "Stop looking for developers. Start building." Subhead stays.

## Files to change

- `src/styles.css` — replace token block, drop Trade Ledger utilities (paper noise, stamp, rule-ledger), add dotted-grid background utility, soft-shadow utility, card-hover utility, floating-card keyframes.
- `src/routes/__root.tsx` — swap font `<link>` tags to Geist Sans (or Inter Tight).
- `src/components/marks.tsx` — replace glyphs with new geometric line icons; remove ampersand mark, add a simple wordmark logo.
- `src/components/site-chrome.tsx` — new header (pill CTA, no italic wordmark) and slimmer footer (drop social column, drop "Set in Fraunces" line).
- `src/components/sections/hero.tsx` — full rewrite: split layout, floating mockup card stack, overlapping avatars, LIVE pill.
- `src/components/sections/trusted.tsx` — grayscale logo row.
- `src/components/sections/who.tsx` — 3 rounded cards, remove stamp letters and ledger footers.
- `src/components/sections/services.tsx` — 3-col grid, remove ledger table.
- `src/components/sections/how.tsx` — horizontal step timeline with circle numbers.
- `src/components/sections/work.tsx` — 2x2 grid with mock UI screenshots (CSS-rendered) + tech pills; drop "Commission 01" framing.
- `src/components/sections/testimonials.tsx` — quote cards, keep the outcome copy.
- `src/components/sections/pricing.tsx` — 3 clean cards, middle highlighted with indigo border.
- `src/components/sections/faq.tsx` — restyle accordion to match card system; keep copy.
- `src/components/sections/contact.tsx` — split layout, restyle form fields to match new system.
- `src/routes/index.tsx` — reorder if needed; SEO metadata refreshed to match new voice.

## Out of scope

No backend changes. No new dependencies. Form submission logic stays as-is. Existing FAQ and testimonial content stays.
