# 04 — Support

**A gap today:** every tier sells a support window — 30 to 60 days
(`src/lib/offers.ts`) — and there is no triage behind it. Without one, "support"
quietly becomes "free work forever," which is how a profitable project becomes an
unprofitable client.

---

## The distinction that protects the business

Every incoming request is one of two things:

| | **Defect** | **Change request** |
|---|---|---|
| Definition | Doesn't meet the SOW's acceptance criteria | Anything else |
| Cost | Free, inside the window | Quoted, via change order |
| Authority | Agent can log and acknowledge | **Human quotes it** |

Almost every support dispute is really a disagreement about which of these a request
is. The defence was built earlier: **acceptance criteria written in the SOW before the
work started** (`../../contracts/sow-template.md` §5). Support triage just applies it.

**Saying "that's a change request" calmly and immediately is the whole skill.** Said
late, it sounds like an excuse. Said at once, with the criteria quoted, it's just how
the agreement works.

---

## SOP 04.1 — Intake and triage

**TRIGGER** — Client reports an issue by any channel.

**STEPS**
1. Log a `support_tickets` row: project, description, reported_at, channel.
2. Acknowledge within the response target below.
3. Classify against the SOW acceptance criteria: **defect**, **change request**, or
   **unclear**.
4. Route.

**DECISION RULES**
- Matches an acceptance criterion and doesn't behave as specified → **defect**.
- Works as specified but the client wants it different → **change request** → human.
- Can't be determined from the criteria → **unclear** → human. Do not guess. A wrong
  "that's billable" is expensive to walk back.
- Outside the support window → human, always.
- **Security concern, data exposure, or suspected breach** → stop, escalate
  immediately to [08-security-incident](../08-security-incident/).

**PROHIBITIONS** — Agents never tell a client something is billable, never quote a
price, never promise a fix or a timeline (charter §3.1). They acknowledge and route.

---

## Severity and response targets

| Severity | Definition | Acknowledge | Human response |
|---|---|---|---|
| **1 — Down** | Production unusable, data at risk, payments failing | 2 business hours | Same business day |
| **2 — Impaired** | Core function broken, workaround exists | 4 business hours | 1 business day |
| **3 — Minor** | Cosmetic, edge case, low impact | 1 business day | 3 business days |
| **4 — Question** | How-to, clarification | 1 business day | 3 business days |

**These are internal targets, not contractual SLAs.** Nothing in the MSA or on the site
promises response times to a client, and an agent must never state one — that would be
committing the business to a term nobody signed (charter §3.1).

If a client wants a contractual SLA, that's a retainer conversation and a human one.

---

## SOP 04.2 — Support window expiry

**TRIGGER** — 7 days before the window closes.

**STEPS** — Draft a note: the window closes on {{date}}, here's what was handled during
it, here's what ongoing support would look like. Human reviews and sends.

**DECISION RULES** — Client logged three or more tickets during the window → flag as a
**strong retainer signal** and route to [05-retention](../05-retention/). They've
demonstrated a need rather than been sold one.

**PROHIBITIONS** — Never frame expiry as a deadline to buy something. It's an
expectation-setting message, not a close.

---

## The support log is a business instrument

Every ticket records: defect or change, severity, time to resolve, and whether it fell
inside the window. That produces three things you can't get any other way:

1. **Whether the support window is priced correctly.** If projects consistently consume
   more support than budgeted, the window is too long or the price is too low.
2. **Whether a client needs a retainer.** Steady requests after the window is the
   client telling you, without being asked.
3. **Where delivery quality is weak.** A cluster of defects in one area is a signal
   about the review gate, not about the client.

Reviewed monthly ([`../09-operating-calendar.md`](../09-operating-calendar.md)).
