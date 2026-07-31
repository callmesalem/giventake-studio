# 01 — Structure and formation

**Jurisdiction:** Ohio
**Existing entity:** GivenTake Goods LLC (EIN and bank account already in place)
**Trade name to register:** GivenTake Goods Devs

---

## Entity of record

Confirmed from the filed Articles of Organization (Form 610):

| Field | Value |
|---|---|
| **Legal name** | GIVENTAKE GOODS LLC |
| **Type** | Domestic limited liability company, Ohio |
| **Ohio SOS document ID** | 202225804070 |
| **Filed / effective** | 9/15/2022 |
| **Statutory agent** | Shukri Salem |
| **Agent address** | 11115 Cheyenne Trl Apt 201, Parma, OH 44130 |
| **County** | Cuyahoga |
| **Organizer** | Lovette Dobson |
| **Stated purpose** | "PROVIDING CONTRACTOR SERVICES AND WHOLESALING CONSUMER PRODUCTS" |

Three consequences follow from this, in order of how much they matter.

### 1. The stated purpose does not cover software — fix it ⚠️

The Articles state the company's purpose as *"providing contractor services and
wholesaling consumer products."* Software development, AI services, and web
development are not within a natural reading of that.

**This is probably not an entity-power problem.** Ohio Revised Code § 1706.16
permits an LLC to be formed for any lawful purpose, the purpose field on Form 610
is expressly **optional**, and Ohio LLCs generally have the power to engage in any
lawful business. An attorney will very likely tell you the LLC can lawfully
perform software services regardless of what the Articles say.

**The problem is who else reads the Articles.** The stated purpose is on the
public record, and it is the first document an underwriter, a bank, or a client's
counsel pulls:

- **Insurance underwriting is the real risk.** You are about to apply for
  technology E&O coverage. If the carrier later looks at an entity whose articles
  of record describe contractor services and wholesaling, they have an opening to
  argue the operations were not as represented on the application. Coverage
  disputes turn on exactly this kind of mismatch, and they surface at the worst
  possible moment — after a claim.
- **Banking and vendor classification.** A mismatch between stated purpose and
  actual activity can trigger review, particularly when you add a trade name to
  the account.
- **Client due diligence.** A procurement team that pulls your Articles and finds
  "wholesaling consumer products" has a question you'd rather not answer mid-deal.

**Resolved by forming a new entity.** The original fix here was a Certificate of
Amendment (Form 543A, $50) to broaden the purpose clause. That is no longer the
plan — see "The decision" below. On the new entity you simply write a
general-purpose clause on day one, which costs nothing and never needs amending.

The insurance-mismatch reasoning above still stands, and it is part of why the
recommendation changed: applying for technology E&O against an entity whose
public record describes contracting and wholesaling was always going to be an
awkward application. Now it doesn't have to happen at all.

**Only relevant if you later resume trading through GivenTake Goods LLC** — at
that point, amend the purpose to match whatever it actually does.

### 2. The statutory agent address is a residential apartment

The agent address of record is an apartment in Parma. Two things follow:

- **Do not publish it as the business address on the website.** The Terms and
  Privacy pages need a servable business address (`BUSINESS_ADDRESS` in
  `src/lib/seo.ts`), and this one is a home. Use a commercial registered-agent
  address or a virtual office instead — see the statutory agent section below.
- **It is already on the public record** via the Articles. Changing the agent
  address going forward doesn't retract the historical filing, but it does stop
  compounding the exposure.

### 3. "Contractor services" is a useful signal for positioning

The entity was formed to provide **contractor services** and wholesale consumer
products. That is not a coincidence worth ignoring: combined with the insurance
claims business, you have direct operating experience in **two** adjacent
industries — contracting/trades and claims — that both run on paper, spreadsheets,
and phone tag.

That strengthens the vertical recommendation in
[05-pricing-and-positioning.md](./05-pricing-and-positioning.md) §3
considerably. It is no longer "you happen to know the claims industry" — it is
"you have operated a contracting business and a claims business, and you are
building software for contracting and claims businesses." Very few competitors
can say that.

### Still needed

The Articles do not identify members (Ohio doesn't require it), so they do not
establish who owns the company.

- **TODO(you):** confirm whether an **operating agreement** exists. If not, this
  is a real gap — for a single-member LLC it is the only document establishing
  ownership, and banks, insurers, and courts all expect one. It is also where the
  purpose and the new line of business get recorded.
- **TODO(you):** confirm **current good standing** with the Ohio SOS. The entity
  was formed in 2022; an LLC can be cancelled for failure to maintain a statutory
  agent. A filing cannot be made against an entity not in good standing, so this
  blocks the trade name registration.
- **TODO(you):** confirm the EIN was obtained in the LLC's name (not a sole
  proprietorship EIN).

---

## The decision: form a new LLC ✅ **decided**

**Form a new Ohio LLC for the software business. Do not run it through GivenTake Goods LLC.**

> **This reversed an earlier recommendation in this document.** The original
> advice was to register a trade name under the existing entity, on the
> assumption it was a clean, general-purpose LLC. It isn't: the entity
> **performed contractor work**, held an **Ohio vendor's licence**, and has since
> stopped trading entirely.
>
> **Note on why "I stopped doing that work" doesn't resolve it.** The construction
> statute of repose runs from **substantial completion of each job**, not from
> when the business wound down. Ceasing to trade in, say, 2023 does not end the
> exposure in 2023 — it ends roughly ten years after the last job was completed.
> A dormant entity with a live tail is precisely the thing you don't want
> underneath a new business, because it looks harmless and isn't.

### Why: the construction liability tail

This is the decisive fact, and it is the one most people miss.

Ohio's construction statute of repose (**ORC § 2305.131**) allows claims arising
from a defective or unsafe condition of an improvement to real property to be
brought **up to ten years after substantial completion**. It applies to claims
sounding in **both tort and contract**. And if a defect is discovered in years
eight through ten, the claimant gets **a further two years from discovery** — so
the real outside edge is closer to twelve years.

GivenTake Goods LLC performed contractor work starting around 2022. That means
the entity carries construction-defect exposure into roughly **2032–2035**,
depending on when the last job was completed.

Now consider what happens if the software studio lives inside that entity:

- A construction claim in 2029 reaches the **software business's** bank account,
  receivables, equipment, and client relationships. Same entity, same assets.
- **Your technology E&O policy will not cover it.** Tech E&O covers professional
  services in technology. A defective-construction claim is squarely outside it.
- **The old general liability policy is probably long lapsed.** If the contracting
  work was insured at the time on an occurrence-based GL policy, that policy may
  still respond to a claim for work performed during its period — worth checking.
  If it was claims-made, or if there was no GL at all, the exposure is uninsured.
- So the entity would be carrying an **uninsured, decade-long liability tail**
  underneath a brand-new business. That is the opposite of what an entity is for.

A new LLC does not make that tail disappear — it stays with GivenTake Goods LLC,
where it belongs. What it does is make sure the tail cannot reach the software
business.

### The vendor's licence — likely resolved, worth confirming

A vendor's licence was obtained and is no longer held. If it was **formally
cancelled with a final return filed**, this is closed and there is nothing to do.

The one thing to check is *how* it ended. Ohio requires a sales tax return **every
filing period even when sales are zero**, so a licence that was simply abandoned
rather than cancelled can leave unfiled periods behind — with penalties and
estimated assessments attached, and notices going to a residential address. A
licence revoked by the Department for inactivity is not the same as one you
closed out.

One lookup settles it → [07-legacy-entity-cleanup.md](./07-legacy-entity-cleanup.md) §1.

Either way this no longer drives the structure decision. The construction tail
does that on its own.

### Why the cost objection disappears

The original argument against a second LLC was compliance overhead and cost.
Run the numbers now:

| Path | Filings | Cost |
|---|---|---|
| **Reuse existing entity** | 543A purpose amendment ($50) + 534A trade name ($39) + possible reinstatement ($25) | **$89–114** |
| **New LLC** | Form 610 ($99). **No trade name filing needed** — the entity name is the brand name | **$99** |

Effectively identical. And the new-LLC path is *simpler*: no purpose amendment
because you write the purpose correctly on day one, and no DBA layer because
`GivenTake Goods Devs LLC` is both the legal name and the brand.

The remaining costs of a second entity are a new EIN (free, same day online) and
a new bank account (an afternoon). The existing bank account being open was the
last real advantage of reuse, and it is worth about one afternoon.

### What you give up

Being straight about the trade-off:

- **The 2022 formation date.** Business age has some value for business credit,
  net-30 vendor applications, and perception. A new entity starts at zero. This
  is real but small, and it is not worth a decade of uninsured construction
  exposure.
- **Two entities to keep separate.** You now genuinely do need separate books,
  separate accounts, and no commingling. That discipline was recommended anyway.

### Naming

`GivenTake Goods Devs LLC` may not be **distinguishable** from `GIVENTAKE GOODS
LLC` on the Ohio SOS records — entity designators (LLC, Ltd., Co.) do not create
distinguishability, and an added word sometimes does not either.

If it is rejected, this is easily solved: **Form 590, Consent for Use of Similar
Name**, signed on behalf of the existing entity. Since you control both, the
consent is a formality.

**TODO(you):** run the name through the Ohio SOS business search before filing.
Have a second choice ready.

### When reuse would have been right

For the record, so the reasoning is reviewable: if the entity had been formed and
never traded, reuse would have been correct — the 2022 formation date is free
value, and the purpose amendment is trivial. It is specifically the **contractor
work performed** that makes the entity unsuitable, because that is what created a
long-tail liability an E&O policy will not answer for.

---

## Filings and setup — new entity

### 1. Form a new Ohio LLC — **Form 610, $99**

- **Name:** `GivenTake Goods Devs LLC` (check distinguishability first; Form 590
  consent from the existing entity if needed — see "Naming" above)
- **Purpose:** write a **general-purpose clause** — "any lawful purpose for which
  a limited liability company may be organized under Chapter 1706 of the Ohio
  Revised Code." The purpose field is optional, and a general clause never needs
  amending. This is the mistake the 2022 filing made; don't repeat it.
- **File with:** Ohio Secretary of State, OhioBusinessCentral.gov
- **Before filing:** search the Ohio SOS business database, and separately search
  the USPTO. State registration is not a trademark and gives you no protection
  against a federal trademark holder.

**No trade name filing (534A) is needed** on this path — the legal name and the
brand name are the same. That saves $39 and a document.

### 2. New EIN

Free, online, same day, at IRS.gov. **A new entity needs its own EIN** — the
existing one belongs to GivenTake Goods LLC and cannot be reused.

### 3. New bank account

The existing account stays with GivenTake Goods LLC. Open a separate account for
the new entity and **never run the two businesses through one account** — with
two live entities, commingling is now the single most likely way to lose the
liability protection this whole restructure is for.

### 4. Statutory agent

Ohio requires every LLC to maintain a statutory agent with an Ohio street address
— no PO boxes. This is where service of process and state correspondence go.

This is worth getting right on the new entity from the start, because **failure
to maintain a statutory agent is the one way an Ohio LLC dies**: the SOS gives
notice, and if it is not cured within 30 days the articles are cancelled without
further notice. (Reinstatement is Form 525-A, $25 — but avoid needing it.)

**On the existing entity, the agent of record is Shukri Salem at a Parma
apartment address.** That works legally, but it means a home address is on the
public record and it is not an address to publish in the site's Terms and Privacy
pages.

**Recommended:** appoint a commercial statutory agent ($50–$150/yr) **for the new
entity**. This gives you an Ohio street address that is servable, professional,
and publishable — and it solves the `BUSINESS_ADDRESS` placeholder in
`src/lib/seo.ts` at the same time.

A virtual office with a real Cleveland-area street address is the alternative and
often costs about the same.

### 4. Annual reports — **Ohio does not require them for LLCs**

This is a genuine advantage over most states and is worth knowing so you can
recognise an upsell. Ohio LLCs file no annual report and pay no annual report
fee. Registered-agent services sometimes bundle "annual report filing" into
their pricing for states where it doesn't exist. Decline it.

What you _do_ still need to keep current: the statutory agent designation, and
any change of address filed with the SOS.

### 6. Operating agreement — write one for the new entity

Ohio does not require an operating agreement and does not require the Articles to
name members. That means for a single-member LLC, **the operating agreement is
the only document establishing who owns the company**. Banks, insurers, and
courts all expect one.

**Draft one at formation** rather than adding it later. It should include:

- Member identity and ownership percentage
- A **general purpose clause** — matching the Articles
- Management structure and signing authority
- Capital contributions
- What happens on death, disability, or transfer

**VERIFY (attorney).** This is inexpensive to do properly and awkward to
reconstruct after the fact.

**Separately: does GivenTake Goods LLC have an operating agreement?** If not,
that's worth fixing on its own — that entity is going to keep existing to hold
the construction tail, and it should be properly documented too.

### 7. Keeping the two entities separate

With two live entities, this stops being bookkeeping hygiene and becomes the
thing the whole restructure depends on. If the two are run out of one account,
a claimant against the contracting entity can argue they were never really
separate — and the liability isolation you paid $99 for evaporates.

- **Separate bank accounts.** Not sub-accounts. Separate.
- **Separate books.** Separate accounting files or clearly separated entities in
  one system.
- **Separate contracts, invoices, and email signatures.** Client-facing documents
  must name the correct entity.
- **No paying one entity's bills from the other's account.** If one entity needs
  to fund the other, document it as a loan or a capital contribution.
- **Never pay personal expenses from either business account.** Commingling is
  the single most common reason courts disregard a small LLC's liability shield —
  more common by far than any entity-structure mistake.

### 8. Local registration

The existing entity's address of record is in **Parma, Cuyahoga County**.

**TODO(you):** confirm where the software business will actually operate from.
The agent address and the place of business can differ, and municipal income tax
follows where the work is done, not where the agent sits. Parma may also require
a local business registration independent of the state.

Cuyahoga County is the venue used in the MSA's governing-law clause. See
[02-ohio-tax.md](./02-ohio-tax.md) for the municipal tax consequences, which are
significant — Parma's rate is among the higher ones in Ohio.

---

## Summary of costs

**New entity — GivenTake Goods Devs LLC:**

| Item                              | Cost                  | Recurring |
| --------------------------------- | --------------------- | --------- |
| Ohio LLC formation (Form 610)     | $99                   | One-time  |
| Form 590 consent, if name rejected | $0 (filed with 610)  | —         |
| Trade name (534A)                 | **$0 — not needed**   | —         |
| New EIN                           | $0                    | —         |
| New bank account                  | $0                    | —         |
| Commercial statutory agent        | $50–$150              | Annual    |
| Ohio annual report                | **$0 — not required** | —         |
| Operating agreement               | Attorney time         | One-time  |

**Legacy entity — GivenTake Goods LLC:** see
[07-legacy-entity-cleanup.md](./07-legacy-entity-cleanup.md). Costs there depend
entirely on what the vendor's licence sweep turns up.

The structural setup is still cheap — about $100 plus an agent. The expensive
items are insurance ([03](./03-insurance-and-risk.md)), the sales-tax question
([02](./02-ohio-tax.md)), and whatever the legacy vendor's licence account has
been accruing ([07](./07-legacy-entity-cleanup.md)). Spend your attention there.
