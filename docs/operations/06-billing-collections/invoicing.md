# Invoicing

## SOP 06.1 — Issue an invoice

**TRIGGER** — A milestone in the signed SOW becomes due: signature (deposit), a named
milestone, acceptance, or a retainer billing date.

**INPUTS** — SOW reference, milestone, amount **as written in the SOW**, client billing
contact, the tax split from SOW §7.

**STEPS**
1. Verify the milestone condition is genuinely met. Acceptance-triggered invoices
   require written acceptance on file (`../../business/09-client-process.md` stage 8).
2. Generate the invoice in Stripe with **separately stated line items** (see below).
3. Apply payment terms from MSA §5.3 — net 15 unless the SOW says otherwise.
4. **First invoice on any new project: hold for human approval.** After that,
   milestone invoices on the same SOW may send automatically.
5. Send. Log the `invoices` row and a `touchpoints` row.
6. Schedule the reminder ladder ([collections.md](./collections.md)).

**DECISION RULES**
- Amount not exactly matching the SOW → **stop and escalate.** Never reconcile a
  discrepancy, never round, never pro-rate.
- Milestone condition unmet or ambiguous → escalate.
- Client has an open dispute on any invoice → hold and escalate.

**PROHIBITIONS** — No amount not in the SOW. No discount. No adjusted terms. No
invoice for work covered by a change order that isn't signed (charter §3.1).

**AUDIT** — `agent_log`: milestone verified, amount source, approval status, send.

---

## ⚠️ The line-item split

**Every invoice separates exempt development from taxable services.** This is not
formatting.

Ohio taxes automatic data processing, computer services, and electronic information
services, while custom software written to one customer's specification is generally
exempt — and which side a charge falls on turns on the "true object" test. **A bundled
line item gives an auditor no basis to apportion, and the path of least resistance is
to tax the whole thing.**

```
Custom development — [description per SOW]        $X,XXX.00   [exempt / taxable]
Hosting and maintenance — [description]             $XXX.00   [exempt / taxable]
```

Rules:
- Line items and amounts **match SOW §7 exactly.** The SOW is the source; the invoice
  restates it.
- Never merge lines to make an invoice look tidier.
- Never invent a description. Copy it.
- **Never collect sales tax without a vendor's licence.** Collecting tax you aren't
  licensed to collect is its own violation.

**VERIFY (CPA)** — the taxable/exempt determination for your actual service mix is
unresolved and is the highest-value tax question you have.
See [`../../business/02-ohio-tax.md`](../../business/02-ohio-tax.md) §1.

---

## SOP 06.2 — Record a payment

**TRIGGER** — Stripe payment webhook, or a manual payment logged by a human.

**STEPS**
1. Match to the invoice. Update `invoices.paid_at` and status.
2. **Cancel any scheduled reminders immediately.** A reminder sent after payment is
   the most common and most irritating automation failure there is.
3. **Move 25–30% to the tax reserve** (`../../business/02-ohio-tax.md` §4) — flag the
   transfer for the human; agents do not move money between accounts.
4. If this payment clears the final invoice on a project, notify: **IP transfers on
   full payment** (MSA §4.1), which unblocks handoff.

**DECISION RULES** — Partial payment → do not treat as paid, do not resume the ladder,
escalate. A partial payment is usually a message.

---

## SOP 06.3 — Failed payment

**STEPS**
1. First failure: notify the client neutrally — a card issue, not an accusation.
   Retry in 3 days.
2. Second failure: **stop and escalate.** No third automated attempt (charter §3.10).

**PROHIBITIONS** — Never imply intent. A declined card is almost always an expiry date.

---

## SOP 06.4 — Monthly close

**TRIGGER** — First business day of the month.

**OUTPUTS** — Invoices issued and paid · AR aging (0–30 / 31–60 / 61–90 / 90+) ·
overdue list with ladder position · tax reserve balance vs. target · revenue split by
taxable and exempt · effective hourly rate per completed project
(`../../business/05-pricing-and-positioning.md` §7).

The taxable/exempt split isn't bookkeeping tidiness — it's the number that makes the
sales-tax filing possible and defensible if anyone asks later.

---

## Deposits and terms — the actual protection

Worth restating, because it's what makes collections rare:

- **50% deposit before work starts**, cleared, not merely promised (MSA §5.2)
- **Milestone billing** — never carry more exposure than one milestone
- **IP transfers only on full payment** (MSA §4.1); before payment the client has no
  licence to use deliverables in production (§4.4)
- **Suspension right after 10 days' written notice** of non-payment (MSA §5.4)

A studio that bills on completion and chases afterwards has a collections problem.
One that takes deposits and bills milestones mostly doesn't.
