# Collections — the dunning ladder

**Read [legal-boundaries.md](./legal-boundaries.md) before configuring any of this.**

The ladder assumes non-payment is a cash-flow problem, a lost email, or an unhappy
client who hasn't said so — because it usually is. It gets firmer, stays specific, and
**hands to a human at day 21**, which is roughly where an overdue invoice stops being
administrative.

---

## The ladder

| Day past due | Contact | Sent by | Tone |
|---|---|---|---|
| +1 | Reminder | Agent | Neutral. Assume it was missed. |
| +7 | Second reminder | Agent | Direct. Ask if something's wrong. |
| +14 | Final automated notice | Agent | Firm. States what happens next factually. |
| +21 | **Human takes over** | **Human** | Phone call, not email. |
| +30 | Suspension decision | **Human** | Per MSA §5.4, 10 days' written notice. |
| +60 | Write-off or escalation decision | **Human + attorney** | |

**No automated contact after day 14.** Charter §3.3 and the three-contact cap in
[legal-boundaries.md](./legal-boundaries.md).

---

## SOP 06.5 — Automated reminders (days 1, 7, 14)

**TRIGGER** — Invoice past due date, unpaid, no dispute flag, no human hold.

**STEPS** — Send the template for the current rung. Log `touchpoints` and `agent_log`.
Schedule the next rung. At day 14, mark `handoff_to_human` and notify.

**DECISION RULES — the freeze conditions.** Halt the ladder and escalate immediately on
**any** of these:
- Client disputes the amount, the work, or the terms
- Client expresses dissatisfaction in any form
- Client mentions a lawyer, a chargeback, or a refund
- Client proposes a payment plan or different terms
- Partial payment arrives
- Any reply the operator cannot confidently classify as "acknowledged, paying soon"

**PROHIBITIONS**
- Never state a consequence not written in the signed contract
- Never name a collection agency, attorney, or credit bureau
- Never contact anyone but the billing contact and the recorded decision-maker
- Never send more than three automated messages per invoice
- Never compute a late fee above the MSA §5.3 figure, and never apply one at all
  unless a human has enabled it for that client

**AUDIT** — Every rung logged with the exact content sent.

---

## Templates

All carry the charter §5 auto-sent footer.

### Day +1

> **Subject:** Invoice {{number}} — due {{due_date}}
>
> Hi {{first_name}},
>
> Invoice {{number}} for {{amount}} was due on {{due_date}}. It may well have been
> missed — here's the link again: {{payment_link}}
>
> If it's already been paid in the last day or two, ignore this.

### Day +7

> **Subject:** Invoice {{number}} — still outstanding
>
> Hi {{first_name}},
>
> Invoice {{number}} for {{amount}} is now {{days}} days past due.
> {{payment_link}}
>
> If there's a problem with the invoice, the work, or the timing, reply and tell me —
> a reply is genuinely more useful than a payment I'm not expecting. If something
> needs sorting out, it's easier to sort out now.

### Day +14 — final automated notice

> **Subject:** Invoice {{number}} — {{days}} days overdue
>
> Hi {{first_name}},
>
> Invoice {{number}} for {{amount}} is {{days}} days overdue and I haven't heard back.
> {{payment_link}}
>
> This is the last automated reminder. Someone will follow up directly next week.
>
> Under our agreement, work can be paused on 10 days' written notice while an invoice
> is outstanding, and rights in delivered work transfer on full payment. Neither has
> happened here — I'm noting it so nothing comes as a surprise.
>
> If there's a reason for the delay, saying so is the fastest route through this.

**On that last template:** it states two facts already in the signed MSA (§5.4, §4.1)
and explicitly says neither has been triggered. That's the boundary — describing the
agreement both parties signed, not threatening a consequence.

---

## Day 21 onward — human only

**Call, don't email.** Three ignored emails and a fourth email is a pattern; a phone
call breaks it. Most overdue invoices resolve on the call, and you usually learn
something worth knowing — that they're struggling, that they're unhappy, or that the
invoice went to someone who left.

Then decide, in this order:
1. **Payment plan** if it's cash flow and the relationship is good. Get it in writing.
2. **Suspend** per MSA §5.4 if there's ongoing work. 10 days' written notice, drafted
   by a human.
3. **Write off** if the amount is small and the relationship is over. Often the
   cheapest answer — check the tax treatment with the CPA.
4. **Attorney** if the amount is material or a dispute is real.

**Collection agency: rarely, and late.** 25–50% fee, the relationship ends permanently,
and their conduct attaches to your name. For a studio building its first reputation
that trade is usually bad.

---

## What actually prevents this

Collections is a downstream symptom. The upstream controls do the work:

- **Deposit cleared before work starts** — never carry unpaid exposure into a build
- **Milestone billing** — the most you can lose is one milestone
- **IP transfers on full payment** (MSA §4.1) — a real, quiet incentive
- **Written acceptance before the final invoice** — removes the "I wasn't happy with it"
  argument
- **Qualification** — `../../business/09-client-process.md` red flags. Clients who
  negotiate hardest over price are the ones who dispute invoices.

**If you find yourself running this ladder often, the problem is upstream.** Fix
qualification and deposits, not the reminder copy.
