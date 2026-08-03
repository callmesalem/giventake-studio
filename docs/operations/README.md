# Operations

How the business actually runs, day to day — written so autonomous agent operators can
execute it, and so a human can pick it up cold.

**Start with [00-agent-operating-charter.md](./00-agent-operating-charter.md).** It
overrides every other document here, and none of the rest is safe without it.

| | Folder | What it covers |
|---|---|---|
| 00 | [agent-operating-charter](./00-agent-operating-charter.md) | Scope boundary, prohibitions, escalation, disclosure, kill switch |
| 01 | [tooling-stack](./01-tooling-stack.md) | The concrete, API-first stack and the data model |
| 02 | [sales-pipeline](./02-sales-pipeline/) | Lead → qualified → proposal → signed |
| 03 | [onboarding](./03-onboarding/) | Client day 0–30, and operator onboarding |
| 04 | [support](./04-support/) | Triage, defect vs change request, severity |
| 05 | [retention](./05-retention/) | Health scoring, retainers, testimonials, offboarding |
| 06 | [billing-collections](./06-billing-collections/) | Invoicing, the dunning ladder, legal boundaries |
| 07 | [marketing-ops](./07-marketing-ops/) | The running layer under `business/08` |
| 08 | [security-incident](./08-security-incident/) | Incident runbook, credentials, agent failures |
| 09 | [operating-calendar](./09-operating-calendar.md) | Everything recurring, plus the metrics |

**Delivery is not here.** It's [`../business/09-client-process.md`](../business/09-client-process.md),
already written and published at `/process`. These SOPs reference it rather than
restating it, so the two can't drift.

---

## Read this in order

**Before client #1** — these block:

1. [00 — charter](./00-agent-operating-charter.md)
2. [01 — tooling](./01-tooling-stack.md)
3. [03 — onboarding](./03-onboarding/)
4. [06 — billing and collections](./06-billing-collections/)
5. [08 — security runbook](./08-security-incident/)
6. [09 — operating calendar](./09-operating-calendar.md)

**By client #3:** [02 sales pipeline](./02-sales-pipeline/) ·
[04 support](./04-support/) · [05 retention](./05-retention/) basics ·
[07 marketing ops](./07-marketing-ops/)

**Later:** the full retention programme, win-back, and anything resembling a
department. **You do not have one and don't need one.**

---

## A note on what this is

These are **functions you run**, documented well enough to hand to an operator. Not
departments. You're one person with no clients yet, and the honest sequencing above
exists so it's obvious what to ignore for now rather than pretending the whole thing
applies on day one.

The reason to write them before you need them is narrow and real: **consistency is your
stated differentiator.** `/process` publicly promises that every project runs the same
way. An SOP written before the pressure is the only thing that makes that true when a
week goes badly.

---

## Four rules that run through everything

1. **Agents run admin and ops. Humans own delivery, scope, price, and client
   conversations.** This is a published commitment, not a preference — see charter §1.
2. **"Use your judgment" is not a valid instruction.** If a step needs judgment it's a
   human step or an escalation.
3. **When uncertain, an operator stops.** Optimise for the annoying failure, not the
   unrecoverable one.
4. **The truthfulness rules that govern the website govern agent output.** No invented
   metrics, no headcount claims, no client anecdotes that didn't happen.
