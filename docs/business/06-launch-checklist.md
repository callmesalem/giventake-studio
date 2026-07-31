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
      `src/lib/seo.ts`. The site currently renders a visible placeholder.
      **Do not use the statutory agent's residential apartment address** from the
      Articles; get a commercial agent or virtual office address first
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

- [x] **Articles of Organization reviewed** — GivenTake Goods LLC, Ohio SOS doc
      202225804070, filed 9/15/2022, Parma / Cuyahoga County
- [x] **Structure decided** — form a **new Ohio LLC**, do not run the studio
      through GivenTake Goods LLC. That entity performed contractor work and
      carries a construction-defect tail to roughly 2032–2035 under ORC 2305.131
      → [01-structure-and-formation.md](./01-structure-and-formation.md)
- [ ] **Check name availability** for `GivenTake Goods Devs LLC` on the Ohio SOS
      search. If not distinguishable from the existing entity, file **Form 590**
      consent alongside — you control both, so it's a formality
- [ ] **Form the new LLC — Form 610, $99**, with a **general-purpose clause**
      _Blocks: everything downstream. No 534A trade name filing needed on this path_
- [ ] **Get a new EIN** (free, IRS.gov, same day) — the existing EIN belongs to
      the old entity and cannot be reused
- [ ] **Open a separate bank account** for the new entity
- [ ] **Appoint a commercial statutory agent** for the new entity — gives you a
      publishable business address and avoids the one failure mode that actually
      kills an Ohio LLC
- [ ] **Draft an operating agreement** for the new entity. Ohio doesn't require
      one and the Articles don't name members, so it's the only document
      establishing ownership
- [ ] **Legacy entity confirmations** → [07-legacy-entity-cleanup.md](./07-legacy-entity-cleanup.md)
      _Short list now that the old entity has stopped trading and holds no
      vendor's licence. Two worth doing early: confirm the licence was formally
      cancelled rather than abandoned, and find out whether the old contracting
      GL was occurrence-based — that determines whether the construction tail is
      insured_
- [ ] **Update `LEGAL_ENTITY` in `src/lib/seo.ts`** to the new entity name once
      formed. The Terms and Privacy pages render it
- [ ] **Bind Tech E&O + cyber insurance**, $1M/$1M — **in the new entity's name**
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
- [ ] **Confirm Parma's municipal net profit tax rate** with a primary source
      (city tax department / RITA / CCA) — third-party rate tables disagree, and
      Parma's rate is among Ohio's higher ones. Confirm too that Parma is where
      you actually work from
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
- [ ] Ongoing: keep the statutory agent designation current **for both entities**
      — failure to maintain one is the single way an Ohio LLC gets cancelled
- [ ] Ongoing: keep the two entities' books and bank accounts strictly separate

---

## The four things that matter most

If everything else slips, do not let these slip:

1. **Insurance before the first engagement**, in the new entity's name.
   Claims-made coverage cannot be bought retroactively after something goes wrong.
2. **A signed SOW before any work starts.** Scope disputes are the most common
   small-studio claim and are entirely preventable.
3. **The sales-tax question answered before the first invoice.** Uncollected tax
   becomes your liability, with interest, discovered years later.
4. **Every published claim true.** That's what this whole exercise was about, and
   it's the one that's cheapest to maintain and most expensive to fix.
