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

**Fix:** file a **Certificate of Amendment or Restatement (Form 543A)** with the
Ohio Secretary of State, **$50** ($100 for two-day expedite). Amend the purpose to
a general clause — "any lawful purpose for which a limited liability company may
be organized under Chapter 1706 of the Ohio Revised Code" — rather than swapping
one narrow description for another. A general clause never needs amending again.

Do this **before** the insurance application, not after. It is $50 and one form,
and it removes the mismatch entirely.

**VERIFY (attorney):** confirm the amendment is the right instrument and that a
general purpose clause is the right drafting. Note also that Ohio requires a
certificate of amendment within 30 days where information in the original
articles "is discovered to be materially false or inaccurate" — worth asking
whether an outdated purpose statement engages that provision.

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

## The decision: trade name, not a second LLC

**Recommendation: register "GivenTake Goods Devs" as a trade name under the existing GivenTake Goods LLC.**

This was worth thinking about carefully rather than defaulting, because the answer
would have been different if the existing entity were your insurance-claims
business. It isn't — GivenTake Goods LLC is a contractor-services and wholesaling
entity, and the naming already lines up. That changes the calculus.

**One check before this recommendation is final. TODO(you):** does GivenTake
Goods LLC hold any **trade licence or contractor registration** — state licensing
through the Ohio Construction Industry Licensing Board (HVAC, plumbing,
electrical, refrigeration, hydronics), or a municipal contractor registration?

Ohio does not license general contracting at the state level, so most likely the
answer is no. But if the entity does hold a licence, the licensing-entanglement
concern I originally raised about the claims business comes back in a different
form: running an unrelated software business under a licensed contracting entity
can complicate the licence, the contractor's bond, and the general-liability
policy underwritten for construction work. If that's the case, tell me and the
recommendation shifts toward a separate LLC.

### Why a second LLC is usually proposed

The argument for a separate entity is liability segregation: if the software
business is sued, only the software business's assets are exposed. That argument
is strong when the two businesses have genuinely different risk profiles — for
example, a licensed or regulated trade sitting alongside an unregulated one,
where a regulator's action against one could entangle the other.

### Why it doesn't apply here

- **No regulated trade to firewall.** GivenTake Goods is not a licensed business,
  so there is no licensing or regulatory cross-contamination to prevent.
- **The real liability control is insurance, not entity count.** For a solo
  software studio, technology E&O coverage does far more protective work than a
  second LLC. A second entity with no assets in it protects nothing; an E&O
  policy pays defence costs. See [03-insurance-and-risk.md](./03-insurance-and-risk.md).
- **A second entity multiplies the compliance surface.** New EIN, new bank
  account, new bookkeeping, separate tax treatment, separate contracts, and two
  sets of records to keep from commingling. Every one of those is a place a solo
  operator can slip, and slipping is what actually pierces a liability shield.
- **You'd be splitting one brand across two entities.** "GivenTake Goods Devs"
  under "GivenTake Goods LLC" reads as one business with a product line. Under a
  differently-named LLC it reads as a shell.

### When to revisit

Form a separate entity if any of these become true:

- You take on employees or a partner in one line of business but not the other
- The software business takes outside investment
- You start handling regulated client data (health, financial, government) where
  a contractual or regulatory requirement forces separation
- The two lines diverge enough that one's risk profile makes the other
  uninsurable or materially more expensive

Until then, one entity with clean books is the right structure.

---

## Filings and setup

### 1. Ohio trade name registration — **Form 534A**

- **Fee:** $39 (expedited service available at additional cost)
- **File with:** Ohio Secretary of State, via the online business portal
- **Choose "trade name", not "fictitious name".** This distinction matters and
  is easy to get wrong on the form:
  - A **trade name** is checked against existing Ohio business names for
    distinguishability and grants you **exclusive** statewide use.
  - A **fictitious name** is merely _reported_. It grants **no exclusivity** —
    anyone else can report the same one.
  - You are building a brand, so you want the trade name. If the name is
    rejected as not distinguishable, that is information worth having before you
    print anything.
- **Before filing:** search the Ohio SOS business database for conflicts, and
  separately search the USPTO database. State trade-name registration is not a
  trademark and gives you no protection against a federal trademark holder.

- ✅ Articles of Organization — **received and reviewed** (see "Entity of record")
- **TODO(you):** current standing with the Ohio SOS — an entity not in good
  standing cannot file, so this blocks the 534A
- **TODO(you):** operating agreement, if one exists
- **TODO(you):** any trade names already registered to the entity

### 2. Certificate of Amendment — **Form 543A, $50**

Amend the purpose clause to a general one before applying for insurance. See
"Entity of record" §1 above for why this matters more than it looks like it does.

### 3. Statutory agent

Ohio requires every LLC to maintain a statutory agent with an Ohio street address
— no PO boxes. This is where service of process and state correspondence go.

**Current agent of record: Shukri Salem, at a Parma apartment address.** That
works legally, but it means a home address is on the public record and it is not
an address you want published in the site's Terms and Privacy pages.

**Recommended:** appoint a commercial statutory agent ($50–$150/yr). This gives
you an Ohio street address that is servable, professional, and publishable — and
it solves the `BUSINESS_ADDRESS` placeholder in `src/lib/seo.ts` at the same
time. Changing the agent is a separate SOS filing; ask whether it can be combined
with the 543A amendment to save a fee.

A virtual office with a real Cleveland-area street address is the alternative and
often costs about the same.

### 4. Annual reports — **Ohio does not require them for LLCs**

This is a genuine advantage over most states and is worth knowing so you can
recognise an upsell. Ohio LLCs file no annual report and pay no annual report
fee. Registered-agent services sometimes bundle "annual report filing" into
their pricing for states where it doesn't exist. Decline it.

What you _do_ still need to keep current: the statutory agent designation, and
any change of address filed with the SOS.

### 5. Operating agreement

The Articles do not identify members, and Ohio does not require them to. **If no
operating agreement exists, nothing currently documents who owns this company** —
that is worth fixing on its own, independent of the software business.

**VERIFY (attorney):** confirm two things in the operating agreement, or draft one:

- **Purpose clause.** If it mirrors the Articles' "contractor services and
  wholesaling consumer products," broaden it to a general-purpose clause ("any
  lawful business") alongside the 543A amendment.
- **Member authorisation.** Record a written member resolution adding the
  software line of business and authorising the trade name registration. For a
  single-member LLC this feels like theatre, but it is exactly the kind of record
  that makes the entity look like a real entity rather than an alter ego if
  anyone ever challenges the liability shield.

### 6. EIN and banking

Same legal entity, so the **existing EIN and bank account carry over** — no new
applications needed. A trade name is not a separate taxpayer.

What to do anyway:

- **Separate the books by line of business.** Either a dedicated bank
  sub-account or an accounting class/tag in your bookkeeping. Not legally
  required, but it makes the sales-tax analysis in
  [02-ohio-tax.md](./02-ohio-tax.md) tractable, and it is what "we kept the
  businesses separate" actually means in practice.
- **Add the trade name to the bank account** so you can deposit cheques made out
  to "GivenTake Goods Devs". Banks generally want to see the filed 534A.
- **Never pay personal expenses from the business account.** Commingling is the
  single most common reason courts disregard a small LLC's liability shield —
  more common by far than any entity-structure mistake.

### 7. Local registration

The agent address of record puts the business in **Parma, Cuyahoga County**.

**TODO(you):** confirm this is where you actually operate from — the agent
address and the place of business can differ, and the municipal income tax
follows where the work is done, not where the agent sits. Parma also may require
a local business registration independent of the state.

Cuyahoga County is also the venue to use in the MSA's governing-law clause. See
[02-ohio-tax.md](./02-ohio-tax.md) for the municipal tax consequences, which are
significant — Parma's rate is among the higher ones in Ohio.

---

## Summary of costs

| Item                                  | Cost                      | Recurring         |
| ------------------------------------- | ------------------------- | ----------------- |
| Ohio trade name (Form 534A)           | $39                       | One-time          |
| **Certificate of Amendment (543A)**   | **$50**                   | One-time          |
| Commercial statutory agent            | $50–$150                  | Annual            |
| Ohio annual report                    | **$0 — not required**     | —                 |
| New EIN / bank account                | **$0 — reusing existing** | —                 |
| Operating agreement (draft or amend)  | Attorney time             | One-time          |

The structural setup here is cheap. The expensive items are insurance
([03](./03-insurance-and-risk.md)) and the sales-tax question
([02](./02-ohio-tax.md)) — spend your attention there.
