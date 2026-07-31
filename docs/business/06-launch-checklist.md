# 06 — Launch checklist

Sequenced by what blocks what. Do not reorder the blocking items — each one
prevents a specific, real problem downstream.

---

## Phase 0 — Before the site goes live

These block publishing. The site currently makes claims and identifies contacts
that need to be true before anyone reads them.

- [x] **Rewrite the case studies** to remove fabricated metrics and the "not
      mockups" claim _(done — commit "Make every claim on the site truthful")_
- [x] **Remove the "Most picked" badge** and other unsupported social proof _(done)_
- [x] **Fix the $500 vs $2.5k budget contradiction** in the contact form _(done)_
- [x] **Set Ohio governing law and venue** in Terms _(done)_
- [x] **Identify the legal entity** in Terms and Privacy _(done)_
- [ ] **TODO(you): business address** — replace `BUSINESS_ADDRESS` in
      `src/lib/seo.ts`. A registered-agent or virtual-office address is fine. The
      site currently renders a visible placeholder
- [ ] **TODO(you): confirm you control `giventake.dev`** and that `hello@`,
      `privacy@`, and `legal@` all deliver. Three published contact addresses
      that bounce is worse than one that works
- [ ] **Decide the production domain** and update `BASE_URL` in `src/lib/seo.ts`
      plus the `Sitemap:` line in `public/robots.txt`. Everything else derives
      from that constant
- [ ] **Complete the AI tool register** — this substantiates the "not used to
      train AI models" claim already published on the contact form
      → [`../contracts/ai-tool-register.md`](../contracts/ai-tool-register.md)

---

## Phase 1 — Before signing the first client

These block contracting. Signing without them is the expensive kind of mistake.

- [ ] **File Ohio Form 534A** trade name registration ($39)
      → [01-structure-and-formation.md](./01-structure-and-formation.md)
      _Blocks: contracting under the name "GivenTake Goods Devs"_
- [ ] **TODO(you): upload LLC documents** for review — articles, standing,
      operating agreement, existing trade names
- [ ] **Confirm/amend the operating agreement purpose clause**; record a member
      resolution adding the software line of business
- [ ] **Bind Tech E&O + cyber insurance**, $1M/$1M
      → [03-insurance-and-risk.md](./03-insurance-and-risk.md)
      _Blocks: first engagement. Claims-made policies do not cover work performed
      before the retroactive date_
- [ ] **Ask the broker the AI-exclusion question** and keep the written answer
- [ ] **Attorney review of the MSA and SOW templates**
      → [`../contracts/`](../contracts/)
      _Blocks: first engagement. Pay particular attention to the IP assignment
      and AI warranty language in_ [04-ai-delivery-policy.md](./04-ai-delivery-policy.md) _§2_
- [ ] **Align the MSA liability cap** to the bound policy limit

---

## Phase 2 — Before the first invoice

These block getting paid correctly.

- [ ] **CPA consultation on Ohio sales tax** for your specific service mix
      → [02-ohio-tax.md](./02-ohio-tax.md)
      _Blocks: first invoice. This is the item most likely to cost real money if
      skipped, and the cost surfaces years later_
- [ ] **Obtain an Ohio vendor's license** if any service is taxable — required
      _before_ collecting any tax
- [ ] **Set up invoicing with separated line items** (exempt development vs.
      taxable services), matching the SOW structure
- [ ] **Confirm the operating city** and its municipal net profit tax obligation
- [ ] **Cancel any stale CAT account** if one exists
- [ ] **Set up the tax reserve** — 25–30% of every payment moved on receipt
- [ ] **Separate the books** by line of business (sub-account or accounting class)
- [ ] Add the trade name to the bank account so cheques to "GivenTake Goods Devs"
      deposit

---

## Phase 3 — Operational readiness

Not blocking, but each one prevents a predictable first-year problem.

- [ ] **Write the incident response runbook** (one page)
      → [04-ai-delivery-policy.md](./04-ai-delivery-policy.md) §7.
      Your privacy policy already commits to 72-hour breach notification
- [ ] **Assemble the security questionnaire pack**
- [ ] **Build the delivery review checklist** into a repo template — the
      substantiation for "nothing ships without my manual review"
- [ ] **Add licence scanning / SBOM generation** to the delivery process
- [ ] **Add CI** to this repo (lint, typecheck, build on PRs). There is currently
      none, so nothing prevents a broken build reaching the connected Lovable branch
- [ ] **Replace the `mailto:` contact and DSAR forms** with a real server-side
      handler. Both currently lose any submission from a device with no mail
      client configured — for the DSAR form that's a compliance gap, not just a
      lost lead
- [ ] Set up time tracking — you cannot compute effective hourly rate without it
      → [05-pricing-and-positioning.md](./05-pricing-and-positioning.md) §7

---

## Phase 4 — Go to market

- [ ] **Decide the positioning question:** general AI studio, or claims/restoration
      vertical → [05-pricing-and-positioning.md](./05-pricing-and-positioning.md) §3.
      This is the highest-leverage decision on the list
- [ ] **Decide on the $500 tier** — recommendation is to remove it in favour of a
      $2,500 minimum plus a paid discovery sprint (§1)
- [ ] **Build for your own business first** — a real reference project with real,
      measured numbers
- [ ] **Measure baselines before starting anything**, so results are publishable later
- [ ] **First three conversations from the existing network**, not cold outreach
- [ ] **Add a publicity/reference clause** to the MSA so you can publish results
- [ ] **Get testimonials at delivery**, when the client is happiest
- [ ] **Diary a rate increase** after the third client

---

## Recurring

- [ ] Quarterly: re-verify the AI tool register (vendors change terms)
- [ ] Quarterly: estimated tax payments (federal, state, municipal)
- [ ] Annually: insurance renewal — **never let it lapse**, claims-made coverage
      does not survive a gap
- [ ] Annually: review provider list against the published privacy policy
- [ ] Ongoing: keep the statutory agent designation current with the Ohio SOS

---

## The four things that matter most

If everything else slips, do not let these slip:

1. **Insurance before the first engagement.** Claims-made coverage cannot be
   bought retroactively after something goes wrong.
2. **A signed SOW before any work starts.** Scope disputes are the most common
   small-studio claim and are entirely preventable.
3. **The sales-tax question answered before the first invoice.** Uncollected tax
   becomes your liability, with interest, discovered years later.
4. **Every published claim true.** That's what this whole exercise was about, and
   it's the one that's cheapest to maintain and most expensive to fix.
