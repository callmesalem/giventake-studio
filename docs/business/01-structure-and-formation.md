# 01 — Structure and formation

**Jurisdiction:** Ohio
**Existing entity:** GivenTake Goods LLC (EIN and bank account already in place)
**Trade name to register:** GivenTake Goods Devs

---

## The decision: trade name, not a second LLC

**Recommendation: register "GivenTake Goods Devs" as a trade name under the existing GivenTake Goods LLC.**

This was worth thinking about carefully rather than defaulting, because the answer
would have been different if the existing entity were your insurance-claims
business. It isn't — GivenTake Goods is a general entity, and the naming already
lines up. That changes the calculus completely.

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

**TODO(you):** upload the LLC formation documents. Specifically needed:

- Articles of Organization (confirms formation date and registered name)
- Current standing with the Ohio SOS (an entity not in good standing can't file)
- Operating agreement (see purpose clause below)
- Any trade names already registered to the entity

### 2. Statutory agent

Ohio requires every LLC to maintain a statutory agent (elsewhere called a
registered agent) with an Ohio street address — no PO boxes. This is where
service of process and state correspondence go.

You may serve as your own agent, but a commercial agent ($50–$150/yr) keeps
your home address off the public record. Since your business address will also
appear in the site's Terms and Privacy pages, this is worth the money if you
work from home.

### 3. Annual reports — **Ohio does not require them for LLCs**

This is a genuine advantage over most states and is worth knowing so you can
recognise an upsell. Ohio LLCs file no annual report and pay no annual report
fee. Registered-agent services sometimes bundle "annual report filing" into
their pricing for states where it doesn't exist. Decline it.

What you _do_ still need to keep current: the statutory agent designation, and
any change of address filed with the SOS.

### 4. Operating agreement

**VERIFY (attorney):** confirm two things in the existing operating agreement:

- **Purpose clause.** If it is narrowly drafted to one line of business, amend it
  to cover software development and related services, or replace it with a
  general-purpose clause ("any lawful business").
- **Member authorisation.** Record a written member resolution adding the
  software line of business and authorising the trade name registration. For a
  single-member LLC this feels like theatre, but it is exactly the kind of record
  that makes the entity look like a real entity rather than an alter ego if
  anyone ever challenges the liability shield.

### 5. EIN and banking

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

### 6. Local registration

**TODO(you):** confirm your operating city and county. Some Ohio municipalities
require a local business registration or vendor registration independent of the
state. This also determines your municipal income tax obligation — see
[02-ohio-tax.md](./02-ohio-tax.md), which is the part people forget.

---

## Summary of costs

| Item                          | Cost                      | Recurring         |
| ----------------------------- | ------------------------- | ----------------- |
| Ohio trade name (Form 534A)   | $39                       | One-time          |
| Commercial statutory agent    | $50–$150                  | Annual (optional) |
| Ohio annual report            | **$0 — not required**     | —                 |
| New EIN / bank account        | **$0 — reusing existing** | —                 |
| Operating agreement amendment | Attorney time             | One-time          |

The structural setup here is cheap. The expensive items are insurance
([03](./03-insurance-and-risk.md)) and the sales-tax question
([02](./02-ohio-tax.md)) — spend your attention there.
