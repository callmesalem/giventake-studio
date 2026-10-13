# Website baseline, 2026-10-13

Phase 1 of `docs/superpowers/plans/2026-10-13-website-exposure-and-benchmark-plan.md`.
Every number below was measured today, before any change from that plan
shipped. Where a block could not be measured it says why.

## Phase 0 decisions, as made

| # | Decision |
|---|---|
| 0.1 | **General studio.** Vertical pages only where a client segment shows demand. |
| 0.2 | Search Console: none existed. The homepage already carries a `google-site-verification` meta tag (`Px8gSZ1_…`), so a property may exist under some Google account. To be created or claimed. |
| 0.3 | In-house `trackLeadEvent` and the `leads` table are the analytics of record. No GA4. |
| 0.4 | Home office, no commercial address. Google Business Profile is still possible as a **service-area business with the address hidden**; the address is given to Google for verification only. Decision pending. |
| 0.5 | Bing Webmaster Tools: none. Create after 0.2. |
| 0.6 | Founder bio, photo, case-study screenshots: still outstanding. |

## 1.1 Search presence

Not measurable today. No Search Console. Semrush MCP returned
`no_api_units` (subscription active, zero API units). Re-run once either is
available.

## 1.2 Rankings

Not measurable today, same reason. Position-tracking project not created.

## 1.3 Backlinks

Not measurable today (Semrush). Free-source cross-check deferred to the
re-run.

## 1.4 Core Web Vitals (Cloudflare Observatory, Lighthouse, us-east)

| Page | Device | Perf | TTFB | FCP | LCP | TBT | SI | CLS |
|---|---|---|---|---|---|---|---|---|
| `/` | mobile | 72 | 596 | 2352 | 2956 | 711 | 4566 | 0.01 |
| `/` | desktop | 98 | 56 | 581 | 685 | 26 | 1359 | 0.00 |
| `/pricing` | mobile | 58 | 360 | 2455 | 2755 | 1241 | 3667 | 0.20 |
| `/pricing` | desktop | 97 | 69 | 559 | 664 | 65 | 1701 | 0.04 |
| `/services/marketing-site` | mobile | 64 | 284 | 2145 | 2745 | 1094 | 3635 | 0.15 |
| `/services/marketing-site` | desktop | 47 | 360 | 590 | 630 | 682 | 1974 | 0.76 |
| `/services/marketing-site` (2nd run) | mobile | 88 | | | 2753 | 84 | | 0.15 |
| `/services/marketing-site` (2nd run) | desktop | 71 | | | 646 | 141 | | 0.77 |

Times in ms. Mobile TBT swings 84 to 1241 between runs on the same page, so
treat mobile TBT as noisy; CLS is stable across runs.

**Diagnosed:** the shifting element on the service page is the hero
(`main > section.border-b > div.mx-auto`). `__root.tsx` defers the main
stylesheet on every route, but `critical-css.ts` only styles the home hero.
Every non-home page painted unstyled, then reflowed. Fix in PR #69.

Main-thread breakdown, service page mobile: Other 920 ms, Script Evaluation
546 ms, Rendering 462 ms. Bootup: route chunk 1202 ms, `index` chunk 609 ms.
That is the Phase 7.2 bundle target.

## 1.5 Crawl health (all 24 sitemap URLs fetched)

| Check | Result |
|---|---|
| Status | 24 of 24 return 200 |
| Canonical | Present and self-referencing on every page |
| Robots meta | `index,follow` on 23; home page has none (defaults to index) |
| H1 | Exactly one on every page |
| Title length | 29 to 61 characters, none over 70 |
| Meta description | 87 to 202 characters. Short: `/terms` 87, `/cookies` 95. Long: `/process` 202, `/work` 182 |
| `http://` | Serves 200, no redirect to https |
| `www.` | Serves 200, no redirect to apex. Duplicate host |
| Trailing slash | 307 to the canonical path (should be 301) |
| `/guardrails` | 307 to `/how-we-use-ai` (should be 301) |
| Sitemap | 24 URLs, no `lastmod` on any |
| `/llms.txt` | 200, text/plain |
| `/.well-known/mcp.json` | 200, application/json |
| `/.well-known/security.txt` | 200 |
| `/mcp` GET | 405 (POST-only, expected) |

## 1.6 Schema

Every page: `WebSite`, `[Organization, ProfessionalService]` with
`PostalAddress` (region only) and `telephone`, `Person` (founder).
Service pages add `Service` and `BreadcrumbList`. Articles add `Article`
and `BreadcrumbList`. `/pricing` adds `FAQPage`. Hub pages (`/services`,
`/articles`, `/work`, `/process`, `/book`) carry no page-specific type.
Not yet validated against Google's rich-result tester (Phase 1.6 re-run).

## 1.7 AI crawler access

Cloudflare firewall events, 6-hour sample on 2026-10-13 (Free plan keeps
24 h; the GraphQL dataset returned nothing for longer windows):

| Bot | Path | Action | Rule |
|---|---|---|---|
| ClaudeBot | `/sitemap.xml` (3 times) | block | "Block AI bots on ad pages" (managed) |
| Amazonbot | `/terms`, `/articles`, `/data-request` | block | same |
| PetalBot | `/privacy`, `/careers`, `/services/business-automation`, `/process` | block | same |
| SERankingBacklinksBot | `/` | managed_challenge | Bot Fight Mode |
| python-requests (Twilio) | `/`, `/terms`, `/privacy` | managed_challenge | Bot Fight Mode (now off) |

The managed rule is set to `ai_bots_protection: only_on_ad_pages` yet is
blocking on ordinary pages. Phase 4.1 fixes it.

**Found and fixed the same day:** any renderer without `IntersectionObserver`
or `window.matchMedia` got the root error boundary ("This page didn't load")
on every public page, because `Reveal` wraps every section and threw in its
effect. Firecrawl's renderer reproduced it at both viewports. PR #68 adds the
guards and a jsdom test. How many AI crawlers' renderers hit this is unknown;
Google's does not (both APIs present), but the Lighthouse CLS numbers above
may have been inflated by it on some runs.

## 1.8 AI answer presence

Not measured. Both browser bridges (Chrome extension, Playwright MCP) were
disconnected. Run from a connected session: the ten buyer questions from
Phase 2.5 in ChatGPT, Perplexity, Google AI Overviews and Claude.

## 1.9 Conversion

| Metric | Value |
|---|---|
| Real leads ever (`leads` where `synthetic = false`) | **0** |
| Real leads, last 90 days | 0 |
| Touchpoints, last 90 days | 0 |
| Leads with recorded consent | 0 |

The site has never captured a real lead through its forms. Either traffic
is near zero, or the forms are not converting, or submissions are not
reaching the table. The notification email path (`INTAKE_TO_EMAIL`) has
been used for the Twilio work today and sends; the `capture_website_lead`
RPC path has no evidence of a real call. Phase 5.4 must send a real test
submission and confirm a row lands.

## 1.10 Visual

Firecrawl full-page screenshots at 1440 and 390 both captured the error
boundary, not the site (see 1.7). Re-capture after PR #68 deploys, from a
connected browser session, into `docs/audits/screens/2026-10-baseline/`.

## Defects found during the baseline, by severity

| Sev | Finding | Owner | Fix |
|---|---|---|---|
| Critical | Whole site renders as an error page in browsers lacking `IntersectionObserver` or `matchMedia` | code | PR #68 |
| High | Zero real leads ever captured; capture path unverified end to end | code / you | Phase 5.4 test submission |
| High | CLS 0.77 desktop on service pages, 0.20 mobile on pricing, from deferred stylesheet | code | PR #69 |
| High | AI crawlers (ClaudeBot, Amazonbot) blocked on content pages by a managed rule meant for ad pages | Cloudflare | Phase 4.1 |
| Medium | Mobile performance 58 to 72; route chunk 1.2 s bootup on service page | code | Phase 7.2 |
| Medium | `www` and `http` both serve 200 (duplicate hosts, split signals) | Cloudflare | Phase 7.5 redirect rules |
| Medium | No Search Console, no Bing, no GBP: zero first-party search data | you | Phase 0.2, 0.5, 0.4 |
| Low | 307 redirects where 301 belongs; no sitemap `lastmod`; home page lacks robots meta | code | Phase 7.5 / 1.5 re-run |
| Low | Four descriptions outside 110 to 160 characters | content | Phase 5.7 |
| Blocked | Semrush out of API units: no rankings, backlinks or competitor footprint | you | top up at semrush.com/mcp-access |
