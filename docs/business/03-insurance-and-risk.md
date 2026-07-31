# 03 — Insurance and risk

For a solo software studio, **insurance does more protective work than entity
structure does**. A second LLC with no assets protects nothing. A technology E&O
policy pays for your defence, and defence costs are what actually bankrupt small
businesses — you can win a lawsuit and still be ruined by the legal bill.

---

## What you actually need

### 1. Technology Errors & Omissions (Tech E&O) — the essential one

**This is the policy.** General liability does not cover it.

Tech E&O covers claims that your professional work was negligent, defective, or
failed to perform: the app you built lost the client money, the integration
corrupted their data, the delivery was late enough to cause loss, the system
didn't do what the SOW said it would.

**The claims-made trap.** Most E&O policies are _claims-made_, not
_occurrence-based_. Coverage depends on the policy being in force **when the
claim is filed**, not when the work was done. Two consequences:

- **Buy the policy before the first engagement**, not after. Work performed
  before coverage begins may be excluded entirely unless you negotiate a
  retroactive date.
- **Keep it continuous.** A lapse can permanently orphan every project you
  delivered during the covered period. If you ever wind the business down, buy
  **tail coverage** (an extended reporting period) rather than simply cancelling.

**Typical limits:** $1M per claim / $1M aggregate. This is the level most client
contracts require, and many mid-size clients will not sign without a certificate
of insurance naming those limits. Treat it as a cost of being contractable, not
an optional protection.

### 2. Cyber liability — bundle it

You will hold client credentials, API keys, database access, and possibly their
customers' personal data. Cyber liability covers breach response, notification
costs, forensics, and regulatory defence.

Note the interaction with your own published commitments: your privacy policy
promises breach notification **within 72 hours**. Breach response costs money and
moves fast; this is the coverage that funds it. See the incident runbook note in
[04-ai-delivery-policy.md](./04-ai-delivery-policy.md).

Most carriers sell Tech E&O and cyber as a combined package for small tech
businesses. Buy the package.

### 3. General liability / BOP — lower priority

General liability covers bodily injury and property damage — someone trips at
your office, you damage a client's equipment on-site. For a remote solo operation
the exposure is small, but:

- Some client contracts require it regardless of relevance
- A Business Owner's Policy (BOP) bundles GL with property coverage for your
  equipment, often cheaply
- Buy it if a client requires it or if you ever meet clients in person

### 4. The legacy contractor exposure is a separate problem

**Tech E&O will not cover construction-defect claims from GivenTake Goods LLC's
contracting work.** That exposure runs up to ten years from substantial
completion under ORC § 2305.131 — into roughly 2032–2035 — and it belongs to the
old entity, which is precisely why the software business is being set up in a new
one ([01-structure-and-formation.md](./01-structure-and-formation.md)).

Two things to do with your broker in the same conversation as the E&O quote:

- [ ] **Find out whether the old contracting GL policy was occurrence-based.**
      If it was, it generally still responds to claims arising from work done
      during its period, even though it has lapsed — which materially reduces the
      tail. If it was claims-made and lapsed with no tail purchased, or if there
      was no GL at all, the exposure is uninsured
- [ ] **Ask whether a tail or completed-operations extension can still be bought**
      for the prior work

Details in [07-legacy-entity-cleanup.md](./07-legacy-entity-cleanup.md) §6.

**Do not let the broker write the new tech E&O to cover both businesses.** That
would defeat the separation — and an insurer that discovers construction work
under a technology policy has grounds to dispute the whole thing.

### 5. Not yet

- **Workers' comp** — required in Ohio once you have employees. Ohio is a
  monopolistic state fund (coverage comes from the Ohio Bureau of Workers'
  Compensation, not a private carrier), which is worth knowing in advance.
  Not applicable as a solo owner, but plan for it before a first hire.
- **D&O** — not relevant without outside investors or a board.

---

## The AI question to ask your broker

**Ask directly and get the answer in writing:**

> "Does this policy exclude, limit, or condition coverage for claims arising from
> the use of artificial intelligence, generative AI, or AI-generated code or
> content in the delivery of professional services?"

This matters more for you than for a conventional dev shop, because AI-assisted
delivery is not incidental to your work — it is your stated method, described in
detail on your own website. Some carriers have begun adding AI exclusions or
sublimits. An E&O policy that excludes AI-related claims would exclude
essentially your entire delivery model while appearing to cover you.

Related questions worth asking in the same conversation:

- Is there an exclusion for **intellectual property infringement** claims? This
  is the specific risk of AI-reproduced third-party code (see
  [04-ai-delivery-policy.md](./04-ai-delivery-policy.md)). Some Tech E&O includes
  limited IP infringement coverage; some excludes it entirely.
- Does the policy cover **contractual liability** you've assumed in client
  agreements, or only liability imposed by law? If your MSA indemnifies clients,
  you want the policy to respond to that indemnity.
- What is the **retroactive date**, and can it be backdated?

**Do not accept a verbal "you're covered."** Get the exclusions list and read it.

---

## Aligning insurance with your contracts

Your policy limits and your contractual liability cap should be set together, not
independently. The principle: **never contractually accept liability that exceeds
what your insurance will pay.**

- The MSA's limitation of liability should cap at a figure at or below your E&O
  limit — commonly "fees paid under the applicable SOW" or "fees paid in the
  preceding 12 months"
- Watch for clients striking the liability cap during negotiation. An uncapped
  liability clause converts a $10K project into unlimited exposure, and no
  insurance policy has an unlimited limit
- Watch for **uncapped indemnities**, which achieve the same thing through a
  different clause. A client's redline that leaves the liability cap intact but
  adds an uncapped IP indemnity has not actually left your cap intact
- Any client requirement to name them as an **additional insured** needs to go to
  your broker — it is usually easy, but it is not automatic

See [`../contracts/msa-template.md`](../contracts/msa-template.md), where these
clauses live.

---

## Practical risk controls that cost nothing

Insurance is the backstop. These reduce the chance of needing it:

- **Written scope before work starts, always.** Scope disputes are the most
  common source of small-studio claims, and they are entirely preventable with a
  signed SOW and a written change-order process.
- **Written acceptance criteria.** "The client wasn't happy" is not a defensible
  standard for either side. Define what "done" means before starting.
- **Never hold sole copies of client data.** Backups, and confirmation the client
  has their own.
- **Least-privilege access.** Don't hold production credentials you don't need.
  Hand credentials back at project close and document that you did.
- **Test the payment and auth paths by hand.** These are where negligence claims
  concentrate — an authorization bug that leaks one client's data to another is
  the archetypal Tech E&O claim.
- **Keep your delivery promises modest in writing.** Every "we will" on the
  website and in a proposal is a representation. Your site now says "Nothing
  ships without my manual review" — that is a good commitment, and it is now
  something you must actually do.

---

## Actions

- [ ] Get quotes for combined **Tech E&O + cyber**, $1M/$1M
- [ ] Ask the AI-exclusion question in writing; keep the answer
- [ ] Confirm the retroactive date and whether it can be backdated
- [ ] **Bind coverage before the first signed engagement** — this blocks
      client work, not just good practice
- [ ] Get a certificate of insurance template you can send to clients on request
- [ ] Align the MSA liability cap to the policy limit before the attorney review
- [ ] Diary the renewal date; a lapse is worse than never having had it
