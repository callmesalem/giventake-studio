# Legal boundaries for collections

> **Not legal advice.** Confirm with the Ohio attorney reviewing the MSA
> ([`../../contracts/README.md`](../../contracts/README.md)). This exists so an
> automated process is configured cautiously by default.

---

## The FDCPA does not apply to you

The Fair Debt Collection Practices Act governs **third-party debt collectors** —
people collecting debts owed to someone else. A business collecting its own invoices
is a **creditor**, not a debt collector, and is outside its scope.

**This matters in two directions:**

- You are not bound by FDCPA timing, disclosure, or contact restrictions when chasing
  your own invoices.
- **If you ever hand a debt to a collection agency, the FDCPA binds them** — and their
  conduct becomes a reputational problem attached to your name. Choose carefully.

Additionally, FDCPA is largely a consumer-protection statute. Your clients are
businesses, which puts most consumer collection rules further out of frame.

---

## What still applies

Being outside the FDCPA is not permission to be aggressive. All of these remain live:

**False or misleading statements.** Saying anything untrue in pursuit of payment is
actionable under state unfair-and-deceptive-practices law regardless of who's
collecting. Examples an automated system could produce by accident:
- Claiming a fee, interest rate, or consequence not in the signed contract
- Implying legal action that isn't actually contemplated
- Misstating the amount owed, or the days overdue
- Implying a third party is already involved when they aren't

**Harassment.** Repeated contact at unreasonable frequency, or contact designed to
embarrass, can create liability independent of FDCPA. An operator on a daily loop is
the realistic risk here.

**Ohio's Deceptive Trade Practices Act (ORC 4165)** and general contract law apply to
B2B conduct.

**Late fees are only chargeable because the contract says so.** MSA §5.3 provides
1.5%/month or the maximum permitted by Ohio law, whichever is less. **Ohio caps
interest** — an operator must never compute a rate above the contractual figure, and
the "or the maximum permitted" clause means the applicable cap is a question for the
attorney, not for a formula in a script.

**Defamation.** Telling a third party — a client's customer, a partner, anyone — that
someone hasn't paid is a category of risk with no upside. Charter §3.8: agents contact
only approved recipients.

---

## Hard configuration rules

These are constraints on the automated system, not guidance:

1. **No message may state a consequence that is not written in the signed contract.**
   If the MSA doesn't say it, the operator can't say it.
2. **No message may name a third party** — collections agency, attorney, credit bureau
   — at any automated step. Ever.
3. **Maximum three automated contacts per invoice.** Days 1, 7, 14. Then stop.
4. **A dispute freezes everything.** Any indication the client disagrees with the
   amount, the work, or the terms halts the ladder and escalates immediately.
5. **Never contact anyone but the billing contact and the decision-maker** on record.
6. **Interest and late fees are calculated only from the MSA figure**, applied only
   after the contractual grace period, and only if the human has enabled it for that
   client.
7. **Never suspend service automatically.** MSA §5.4 requires 10 days' written notice.
   The notice is a human act with legal consequence.

---

## When to involve a professional

- **Attorney:** any dispute, any mention of a lawyer, any amount you're considering
  writing off that's large enough to matter, any thought of suing.
- **Collection agency:** rarely, and late. They typically take 25–50%, the client
  relationship ends permanently, and their conduct attaches to your reputation. For a
  studio building its first reputation, a written-off invoice is often cheaper than
  the alternative.
- **CPA:** before writing anything off — the tax treatment matters.

---

## The honest framing

Most unpaid invoices in a small services business aren't fraud. They're cash-flow
problems, a lost email, or an unhappy client who hasn't said so yet.

The ladder in [collections.md](./collections.md) is built on that assumption: firm,
specific, and easy to respond to — and it escalates to a human at exactly the point
where the situation stops being administrative.

**The real protection isn't the chase.** It's the deposit before work starts
(`../../business/09-client-process.md` stage 4), milestone billing, and the fact that
IP transfers only on full payment (MSA §4.1 and §4.4). Get those right and collections
is mostly a formality.
