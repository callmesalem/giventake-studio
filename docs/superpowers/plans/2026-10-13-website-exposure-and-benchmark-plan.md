# Website exposure and benchmark plan

**Status:** Plan. Nothing in it has run yet.
**Date:** 2026-10-13.
**Scope:** The last major tightening pass on giventakedevs.com before focus moves
to the CRM. Two questions, answered with evidence rather than opinion:

1. Does the site get found, by Google, by local search, and by AI answer engines
   (ChatGPT, Perplexity, Google AI Overviews, Claude), and does it turn that
   attention into leads?
2. Is the site itself, its structure, pricing, visuals, front end, back end and
   client interactivity, as good as the best studios it competes with?

Supersedes §4 and §7 of `docs/audits/2026-09-18-full-audit.md` for the public
site. Everything that audit found and PR #56 fixed (H1s, titles, entity schema,
security headers, `llms.txt`, private routes noindexed) is the baseline, not
the target.

---

## Rules for this pass

- **Measure first, change second.** Every phase opens by recording a number
  that the later change can be judged against. No "it feels faster".
- **One decision gates the keyword work.** Positioning (general small-business
  studio versus claims / restoration vertical, `05-pricing-and-positioning.md`
  §3) decides which keywords matter. It is made in Phase 0 or the keyword
  phases produce two lists and double the work.
- **Each finding gets a severity and an owner.** Severity is what it costs in
  leads if left alone. Owner is "code", "Cloudflare", "content", or "you"
  (address, photos, bio, accounts).
- **Nothing ships without the before number.** The backlog in Phase 8 carries
  the baseline beside every item.

---

## Phase 0: Decisions and access (you, one sitting)

These block later phases. Do them before any tool runs.

| # | Decision or access | Blocks |
|---|---|---|
| 0.1 | **Positioning**: general studio, claims/restoration vertical, or general studio with one vertical landing page. Recommendation in `05-pricing-and-positioning.md` §3 is the third. | Phases 2, 4, 5 |
| 0.2 | **Google Search Console** on giventakedevs.com. If it does not exist, create it (DNS TXT via Cloudflare, five minutes). Share read access. | Phase 1 real query data |
| 0.3 | **Google Analytics 4** or confirm the site's own `trackLeadEvent` pipeline is the analytics of record. Share read access if GA4. | Phase 1 conversion baseline |
| 0.4 | **Google Business Profile**: needs a publishable address. Still blocked by the `BUSINESS_ADDRESS` placeholder (launch checklist Phase 0). Decide: virtual office now, or defer local pack entirely. | Phase 3 |
| 0.5 | **Bing Webmaster Tools**: free, imports from GSC, and is what ChatGPT search reads. Create after 0.2. | Phase 4 |
| 0.6 | **Founder bio and photo, one real screenshot per case study.** Still outstanding from last session. | Phase 5 trust signals |
| 0.7 | **Competitor set, final.** Draft list in Phase 6. Add or strike names. | Phase 6 |

---

## Phase 1: Baseline (everything measured once, before any change)

Output: `docs/audits/2026-10-XX-website-baseline.md`, one table per block.

| Block | Metric | Tool |
|---|---|---|
| 1.1 Search presence | Indexed pages, impressions, clicks, average position, top 50 queries, pages with zero impressions | GSC (after 0.2). Fallback until then: Semrush `organic_research` and `domain_overview` |
| 1.2 Rankings | Position for the 20 head terms chosen in Phase 2 | Semrush `position_tracking` project, created in this phase so history starts now |
| 1.3 Backlinks | Referring domains, authority score, toxic links | Semrush `backlinks_research`; `claude-seo:seo-backlinks` for the free-source cross-check |
| 1.4 Core Web Vitals | LCP, INP, CLS, lab and field, home and `/pricing` and one service page, mobile and desktop | `cf speed` (Cloudflare Observatory Lighthouse), `claude-seo:seo-performance`; CrUX via `seo-google` once GSC exists |
| 1.5 Crawl health | Status codes, redirects (307 versus 301), canonical, noindex, sitemap coverage, `lastmod` | `claude-seo:seo-technical`, `seo-sitemap` |
| 1.6 Schema | Every page's JSON-LD validated, which rich results are eligible | `claude-seo:seo-schema` |
| 1.7 AI crawler access | Which AI user agents reach which pages. **Known defect already:** the Cloudflare "Block AI bots on ad pages" managed rule blocked ClaudeBot and Amazonbot on `/terms`, `/articles`, `/sitemap.xml` on 2026-10-13. Record it, fix it in Phase 4. | Cloudflare firewall events (GraphQL), `claude-seo:seo-agentic` |
| 1.8 AI answer presence | Ask ChatGPT, Perplexity, Google AI Overview, Claude the ten buyer questions from Phase 2 and record whether the site is cited, and who is | Manual via Chrome, scripted via Firecrawl `search` with `sources: ["web","news"]`; `claude-seo:seo-geo` for the citability scoring |
| 1.9 Conversion | Visitors to contact-form submits, site-check requests, booked calls, per page and per source, last 90 days | Supabase `leads` and `touchpoints` tables, `trackLeadEvent` events; GA4 if 0.3 |
| 1.10 Visual | Full-page screenshots, desktop 1440 and mobile 390, every public route | Playwright MCP `browser_take_screenshot`; kept in `docs/audits/screens/2026-10-baseline/` for the Phase 5 before/after |

Done when the baseline doc exists and every metric has a number or a written
"not measurable because X".

---

## Phase 2: Keywords and intent (what we want to be found for)

Depends on 0.1.

| Step | What | Tool |
|---|---|---|
| 2.1 | Seed list: every service page title, every pricing FAQ question, "web design Cleveland / Parma / Northeast Ohio", "small business website cost", "website for [trade]" | `marketing-skills:seo-audit`, `claude-seo:seo-plan` |
| 2.2 | Expand and score: volume, difficulty, intent, SERP features (AI Overview present?) for each | Semrush `keyword_research`; `claude-seo:seo-cluster` for SERP-overlap clustering into hub and spoke |
| 2.3 | Competitor keyword gap: what the Phase 6 set ranks for that we do not | Semrush `competitors_research`, `organic_research` per competitor |
| 2.4 | Map every target cluster to a page: existing page, page to rewrite, or page to create. Clusters with no page are the content backlog | `claude-seo:seo-sxo` for page-type mismatch (are we a "service page" where Google wants a "comparison" page?) |
| 2.5 | The ten buyer questions AI engines get asked ("how much does a small business website cost in Ohio", "Webflow agency vs freelancer", "do I need a care plan") | `marketing-skills:ai-seo`, `claude-seo:seo-geo` |

Output: `docs/seo/keyword-map.md`, one row per cluster: cluster, head term,
volume, difficulty, intent, target URL, page status, priority.

---

## Phase 3: Local search

Depends on 0.4. If GBP is deferred, run 3.3 and 3.4 only.

| Step | What | Tool |
|---|---|---|
| 3.1 | GBP audit or creation: category, services, service area, photos, posts, Q&A, review link | `claude-seo:seo-local`, `seo-maps` |
| 3.2 | NAP consistency across the web, citation gaps (Yelp, BBB, Clutch, DesignRush, Ohio directories) | `seo-local` citation check, `marketing-skills:directory-submissions` |
| 3.3 | Location page: `/web-design-cleveland` or similar, with real service-area content, not a doorway | `seo-local` page quality rubric, `seo-sxo` |
| 3.4 | `LocalBusiness` schema completeness once address exists: `address`, `geo`, `openingHours`, `areaServed`, `telephone` (done 2026-10-13) | `seo-schema` |

---

## Phase 4: AI and agent visibility (GEO)

| Step | What | Tool |
|---|---|---|
| 4.1 | **Unblock AI crawlers.** Change the Cloudflare AI bots rule from blocking to allow for GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Amazonbot, Google-Extended, Applebot. Keep "ai_training: disallow" if that is the policy, but search and user agents must get through. Verify with firewall events after. | Cloudflare `bot-management update`, firewall GraphQL |
| 4.2 | `robots.txt` and `llms.txt` review against what 4.1 allows; add `llms-full.txt` if the content warrants it | `seo-agentic`, `seo-geo` |
| 4.3 | Passage citability: every service and pricing page gets a direct-answer paragraph in the first 100 words, a definition, a number, and a named entity (Giventake Goods LLC, Parma, Ohio) | `seo-geo` scoring, `seo-content` for E-E-A-T |
| 4.4 | Entity consistency: same name, same description, same `sameAs` on site, GBP, Bing, LinkedIn, Crunchbase-style listings | `seo-geo`, `seo-local` |
| 4.5 | Public MCP server (PR #62): confirm `/.well-known` discovery resolves, tool card renders in an MCP client, and `request_site_check` works end to end | `seo-agentic`, manual MCP client test |
| 4.6 | Re-run 1.8 after 4.1 to 4.5 ship; the delta is the GEO result | Same as 1.8 |

---

## Phase 5: Lead generation and conversion

This is the "is it truly a lead-gen site" question.

| Step | What | Tool |
|---|---|---|
| 5.1 | Funnel map: every entry page, its CTA, where the CTA goes, what the visitor gets. Count clicks to a submitted form from each entry | `marketing-skills:cro`, Phase 1.9 data |
| 5.2 | Above-the-fold audit, every page: can a visitor say in five seconds who this is for, what it costs, and what to do next | `claude-seo:seo-visual`, `design:design-critique` |
| 5.3 | Trust signals: real founder, real photos, real case studies with numbers, reviews, badges. Today the case studies are labelled illustrative. List what would make each one real | `seo-content` E-E-A-T, 0.6 |
| 5.4 | Forms: field count, friction, error states, mobile keyboard types, what happens after submit (the auto-reply is dormant: should it be on?) | Playwright MCP run-through, `marketing-skills:signup` |
| 5.5 | Offers and pricing presentation: anchoring, the $499 entry versus the $2,500 recommendation in `05-pricing-and-positioning.md` §1, care-plan framing, FAQ | `marketing-skills:pricing`, `offers`, `copywriting` |
| 5.6 | Lead magnets: the free site check is one. Is it visible enough, and should there be a second (cost calculator, "what you get at handoff" checklist PDF)? | `marketing-skills:lead-magnets` |
| 5.7 | Copy pass on every public page against brand voice; expand uncommon terms, cut jargon | `marketing-skills:copy-editing`, `humanizer` |
| 5.8 | Accessibility: WCAG 2.2 AA on every public page, since it is also a ranking and trust factor | `design:accessibility-review`, CI `a11y` job already runs |

---

## Phase 6: Competitive benchmark

Depends on 0.7. Draft set, four tiers:

- **Direct, local:** three Cleveland or Northeast Ohio web design studios that
  rank for the Phase 2 local terms (identified from the SERP, not guessed).
- **Direct, productized:** fixed-price studios selling to small businesses
  nationally, the model this site uses. Candidates from the SERP for
  "small business website package price".
- **Aspirational:** two studios whose craft sets the bar for visuals and
  interactivity, regardless of price. Awwwards and Godly.website shortlists.
- **Substitutes:** Wix, Squarespace, Webflow templates. The real competitor
  for a $499 buyer.

| Step | What | Tool |
|---|---|---|
| 6.1 | Identify the set from SERPs, not memory | Semrush `competitors_research`, Firecrawl `search` |
| 6.2 | Traffic and keyword footprint per competitor | Semrush `traffic_overview`, `organic_research`; `marketing-skills:competitor-profiling` |
| 6.3 | Page-by-page structure comparison: nav, service pages, pricing presentation, portfolio format, CTA placement, forms | `claude-seo:seo-competitor-pages`, Firecrawl `scrape` with `branding` and `links` formats |
| 6.4 | Visual and interaction benchmark: screenshots at the same two viewports, animation, loading, micro-interactions | Playwright MCP, `design:design-critique`, `impeccable` for the gap read |
| 6.5 | Performance benchmark: CWV for each competitor home page | `cf speed` or PSI, `seo-performance` |
| 6.6 | Paid presence: who runs ads, on what terms, with what creative | AdWhispr `find_competitors`, `get_brand_ads`; `claude-ads:ads-competitor` |
| 6.7 | Offers and pricing: what they charge, what is included, their retainer | Firecrawl scrape, `marketing-skills:competitors` |
| 6.8 | Scorecard: one table, rows are criteria from 6.2 to 6.7, columns are us and each competitor, cells are a 1 to 5 with a one-line reason | `marketing-skills:competitive-brief` |

Output: `docs/audits/2026-10-XX-competitive-benchmark.md`.

---

## Phase 7: Site architecture, front end, back end

The "how it's built" review, judged against Phase 6 and the CRM roadmap.

| Step | What | Tool |
|---|---|---|
| 7.1 | Information architecture: does the page set match the Phase 2 keyword map? Pages to add (location, industry, comparison), merge, or cut | `marketing-skills:site-architecture`, `seo-sxo` |
| 7.2 | Front-end review: component reuse, bundle size per route, hydration cost, animation on low-end mobile, the three videos, font loading | `ecc:performance-optimizer`, `ecc:typescript-reviewer`, Chrome DevTools via Chrome MCP |
| 7.3 | Back-end review of the public paths only: intake, site check, MCP server, campaign unsubscribe, consent recording. Silent failures, error handling, rate limits | `ecc:silent-failure-hunter`, `ecc:security-reviewer`, `security-review` |
| 7.4 | Client interactivity: what a prospect can do without talking to a human (site check, book, see pricing, read process). What a client can do after signing (sign SOW, see demo site, pay). Gaps versus competitors | Phase 6.3 findings, `marketing-skills:onboarding` |
| 7.5 | Cloudflare layer: `www` and `http` redirects, 307 to 301, HTML cache headers, bot rules from 4.1, Bot Fight Mode back on after Twilio approval | `cf` CLI, `cloudflare:web-perf` skill |
| 7.6 | Images and OG: every page has a real OG image, alt text, modern formats | `seo-images`, `seo-image-gen` plan |

---

## Phase 8: Backlog, execution, re-measure

| Step | What |
|---|---|
| 8.1 | One backlog: every finding from Phases 1 to 7 with severity, owner, effort, baseline number. Sorted by leads-per-hour-of-work. |
| 8.2 | Ship in PRs grouped by owner and page. Cloudflare changes first (cheapest, widest effect). Code next. Content last, because it depends on 0.1 and 0.6. |
| 8.3 | Re-run Phase 1 in full 30 days after the last PR. The delta table is the result of this pass. |
| 8.4 | Set `claude-seo:seo-drift` baseline so regressions are caught in CI thereafter. |

---

## Tools in hand

Connected and working today: Semrush MCP, Firecrawl, Cloudflare CLI and MCP
(firewall analytics, Observatory speed tests, bot management), Supabase MCP
(lead and event data), Chrome and Playwright browser automation, AdWhispr,
Exa search, the `claude-seo` skill family, `marketing-skills`, `claude-ads`,
`design`, `impeccable`, and the `ecc` reviewers.

## Not connected, and what each would add

| Connector | What it unlocks | Phase | Priority |
|---|---|---|---|
| **Google Search Console** | Real queries, impressions, index coverage, CWV field data. Without it Phase 1.1 is estimated from Semrush, which under-reports a small site. | 1, 8 | Must |
| **Google Analytics 4** or confirmation that the in-house tracking is the record | Conversion baseline by page and source. | 1.9, 5 | Must, one or the other |
| **Google Business Profile** | The local pack. Blocked by the address placeholder, not by tooling. | 3 | Must for local; decide in 0.4 |
| **Bing Webmaster Tools** | Bing index, which ChatGPT search reads. Free, imports from GSC. | 4 | Should |
| **DataForSEO MCP** | Live SERP snapshots and AI-Overview presence checks per keyword at scale; `seo-dataforseo` agent exists but has no server. Semrush covers most of it. | 1.8, 2 | Nice |
| **Ahrefs** (plugin exists, not authenticated) | Second backlink and keyword opinion. Semrush suffices. | 1.3 | Skip unless you already pay for it |
| **Similarweb** (plugin exists, not authenticated) | Competitor traffic estimates. Semrush `traffic_overview` covers it. | 6.2 | Skip |
| **PageSpeed Insights API key** | Un-rate-limited Lighthouse runs for the competitor set. `cf speed` covers our own site. | 6.5 | Nice |
| **GitHub MCP** | Currently failing to connect. `gh` CLI covers everything needed. | all | Skip |
| **Context7** | Currently failing to connect. Only needed for library docs lookups during Phase 7 code work. | 7 | Nice |

Nothing on the "Must" list is a paid tool. Two are Google accounts you may
already have; one is an address decision.
