Plan: UI polish and motion for GivenTake Goods Devs

Scope: whole-page visual upgrade, intensity level 6 (present but not overwhelming).

1. Background texture
- Add a paper-like noise/grain overlay on top of the existing dot grid using a CSS `data:image/svg+xml` or inline base64 noise pattern.
- Keep it extremely subtle (opacity ~0.03-0.05) so it adds texture without hurting contrast or readability.
- Make it dark-mode aware: slightly lighter noise on dark backgrounds.
- Apply it as a fixed pseudo-element so it never repaints per section.

2. Hover micro-interactions
- Cards: add a small translateY(-3px) + shadow lift on hover (services, pricing, work, case studies, quality guardrails).
- Buttons: add a gentle scale(1.02) and icon nudge on hover; keep transitions short (150-200ms) and ease-out.
- Navigation links: add an underline/scale micro-interaction that starts from the center.
- Ensure all hover states still pass contrast and focus-visible is clearly defined.

3. Scroll-triggered reveals
- Create a lightweight `Reveal` component using the Intersection Observer API (client-only, lazy-loaded) to add a `is-visible` class.
- Animate sections up with a fade + translateY(16px) once they enter the viewport.
- Stagger child cards within a section by a small delay (50-80ms each) so grids feel alive.
- Respect `prefers-reduced-motion`: if the user prefers reduced motion, skip the transform and just fade, or disable entirely.
- Do NOT animate the hero H1 or above-the-fold content; this preserves the LCP target.

4. Ambient gradient motion
- Add a slow, large-scale gradient blob behind the hero and a secondary one behind the pricing/quality section.
- Use CSS-only `@keyframes` with `transform` and `opacity` only (no blur/height/width animation that would cause layout/paint).
- Park it behind the same `data-motion="on"` gate so it does not run until after first paint.
- Keep opacity low (~0.15) and colors tied to the existing violet/ink palette.

5. Cursor-driven depth effect
- Add a client-only, lazy-loaded `PointerGlow` component that tracks the mouse position near the hero and brand signature.
- It renders a soft radial gradient that follows the cursor at a reduced opacity (CSS custom properties updated via refs, not React state, to avoid re-renders).
- Defer loading until after the LCP window and only on desktop viewports.
- Disable when `prefers-reduced-motion` is true or on touch devices.

6. Performance and accessibility safeguards
- All new animations use CSS transforms and opacity only.
- Keep the existing `data-motion="on"` gating pattern so motion is non-blocking.
- Add `prefers-reduced-motion` media queries that disable or simplify all new motion.
- Verify no new JavaScript is loaded in the critical path for the first paint (lazy-load scroll/observer logic and pointer effect).
- Run a quick Lighthouse/CLS check to confirm LCP and CLS are not regressed.

Files expected to change:
- src/styles.css — noise overlay, new keyframes, motion utilities
- src/components/sections/hero.tsx — add ambient gradient and pointer glow container
- src/components/sections/services.tsx, pricing.tsx, work.tsx, case-studies.tsx, quality.tsx, testimonials.tsx, how.tsx, who.tsx — wrap sections/cards in Reveal, add hover lift
- src/components/site-chrome.tsx — nav/button hover micro-interactions
- src/components/reveal.tsx (new) — Intersection Observer wrapper
- src/components/pointer-glow.tsx (new) — cursor-driven glow
- src/routes/index.tsx — lazy-load Reveal and PointerGlow as non-critical chunks

Success criteria:
- Visual texture is visible on close inspection but not distracting.
- Cards and buttons feel responsive to hover.
- Sections fade in naturally on scroll without jank.
- Lighthouse mobile LCP stays under the current target; CLS does not regress.
- Reduced-motion users see a static, still-fully-usable page.