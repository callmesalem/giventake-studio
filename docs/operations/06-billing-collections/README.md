# 06 — Billing and collections

- [invoicing.md](./invoicing.md) — issuing invoices correctly, including the Ohio
  sales-tax split
- [collections.md](./collections.md) — the dunning ladder, and where an agent stops
- [legal-boundaries.md](./legal-boundaries.md) — **read before configuring any
  automated chase**

---

## Why this folder is the most carefully bounded one

An autonomous operator chasing money is where a small process error turns into a legal
one. Not because collections law is exotic — for what you're doing, it mostly isn't —
but because the failure mode is *repeatable at scale and in writing*. A human who
oversteps once sends one bad email. A misconfigured operator sends it to everyone,
weekly, with a timestamp.

So the escalation point sits early and the prohibitions are absolute. Read
[legal-boundaries.md](./legal-boundaries.md) before switching anything on.

---

## Split of responsibility

| Agents | Human |
|---|---|
| Generate invoices from SOW milestones | Approve the first invoice on any new project |
| Send reminders at days 1, 7, 14 | Every contact from day 21 onward |
| Log payments and reconcile | Any decision to suspend service |
| Flag failed payments and disputes | Any write-off, settlement, or discount |
| Produce AR aging and monthly close pack | Anything involving a dispute or a lawyer |

---

## The rules that don't bend

1. **Agents never set or change an amount.** Invoices are generated from the signed
   SOW. A number that isn't in the SOW doesn't get invoiced (charter §3.1).
2. **Agents stop at day 21.** Everything past that is human (charter §3.3).
3. **Agents never threaten.** Not consequences, not referral to collections, not legal
   action — not even accurately. Stating a contractual right is a human act.
4. **Development and ongoing services are separately stated** on every invoice.
   This is a tax-position decision, not formatting — see
   [`../../business/02-ohio-tax.md`](../../business/02-ohio-tax.md) §1.
5. **A disputed invoice freezes the ladder immediately** and escalates.
