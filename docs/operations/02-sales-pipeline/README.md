# 02 — Sales pipeline

Covers lead arrival through signature. The *thinking* — what to ask, how to qualify,
when to decline — lives in `../../business/09-client-process.md` stages 0–4 and
`../../business/10-discovery-questions.md`. **This folder is the machinery around
it**, and does not restate it.

**Human owns:** the qualification call, discovery, scoping, and every price.
**Agents own:** logging, acknowledging, preparing, chasing, and reporting.

---

## SOP 02.1 — Lead intake

**TRIGGER** — A contact form submission arrives (via `submitContact` in
`src/lib/intake.ts`), or an inbound email lands in `hello@`.

**INPUTS** — Name, email, company (optional), description, budget, timeline, source.
Missing name or email → escalate; do not guess.

Lead source from the website form is required for every new enquiry. If a lead arrives
by email without a source, ask "How did you hear about GivenTake?" during the first
human reply and backfill the tracker.

**STEPS**
1. Write a `leads` row: source, captured_at, status `new`, full submission body.
2. Deduplicate against `clients` and `leads` on email domain. If matched, link and tag
   `returning`.
3. Send acknowledgement within **1 hour** during business hours, next business morning
   otherwise. Template: `templates/ack-enquiry.md`. Charter §5 footer required.
4. Write a `touchpoints` row.
5. Produce a qualification brief (SOP 02.2) and notify the human.

**DECISION RULES**
- Budget field says "Discovery sprint first" or under $2,500 → tag `below-minimum`,
  still brief it. The minimum is a guide, not a filter; the human decides.
- Submission is spam or a vendor pitch → status `rejected`, no reply, no notification.
- Anything mentioning health, financial, or government data → tag `regulated`,
  escalate before the acknowledgement goes out.

**OUTPUTS** — `leads` row, acknowledgement sent, `touchpoints` row, brief, notification.

**ESCALATION** — Missing required input · `regulated` tag · anything the classifier
can't place · a second send failure.

**PROHIBITIONS** — Never state a price, a timeline, or availability in the
acknowledgement. It confirms receipt and says when a human will respond. Nothing else.

**AUDIT** — `agent_log`: trigger, brief produced, message sent, classification applied.

---

## SOP 02.2 — Qualification brief

**TRIGGER** — A new lead reaches status `new`.

**STEPS**
1. Summarise the submission in plain language.
2. Match against the offers in `src/lib/offers.ts` — which one, or none.
3. Pull the matching module from `../../business/10-discovery-questions.md`
   (business-type and project-type) and attach the questions.
4. Note anything already answered, so the human doesn't re-ask it.
5. Flag any red flags from `../../business/09-client-process.md` visible in the text —
   "should be simple," an immovable external deadline, no named decision-maker.

**OUTPUTS** — A brief the human can read in two minutes before the call.

**PROHIBITIONS** — Never send the brief to the client. It's internal and contains an
assessment.

---

## SOP 02.3 — Post-call follow-through

**TRIGGER** — Human marks a discovery call complete.

**STEPS**
1. Draft the **discovery summary** from the human's notes, using
   `../../templates/discovery-notes.md`.
2. Hold it for human review. **Do not send.**
3. On approval, send within **24 hours** of the call.
4. Set a reminder for the proposal date the human committed to.

**DECISION RULES** — Baseline numbers missing from the notes → flag it. That field is
required (`../../templates/discovery-notes.md`), and it is what makes a real case study
possible later.

**PROHIBITIONS** — Never send the summary unreviewed. It restates the client's problem
in our words, and getting it wrong unreviewed is worse than sending nothing.

---

## SOP 02.4 — Proposal assembly and tracking

**TRIGGER** — Human supplies scope, price, and timeline.

**STEPS**
1. Assemble the proposal from the human's inputs plus the standard sections: what's
   included, what isn't, acceptance criteria, payment schedule.
2. Attach the AI use disclosure — `../../contracts/ai-use-disclosure.md`. Every time,
   unprompted.
3. Human reviews and sends.
4. Track: sent, opened, signed.

**DECISION RULES** — Any field blank → escalate. Never infer a price, a date, or a
scope line from a similar past project.

**PROHIBITIONS** — Never generate or adjust a number. Assembly only. Charter §3.1.

---

## SOP 02.5 — Follow-up cadence

**TRIGGER** — Proposal sent, no response.

**STEPS** — Day 3: light check-in. Day 7: offer to answer questions. Day 14: final,
explicitly closing the loop. **Then stop.**

**DECISION RULES**
- Any reply → cadence ends, human takes over.
- Client said "not now, follow up in N weeks" → suppress cadence, schedule one
  check-in at N.
- After day 14 with no response → status `dormant`, no further contact until they
  re-engage or a human decides otherwise.

**PROHIBITIONS** — Never more than three follow-ups. Never introduce urgency that
isn't real ("prices rise Friday," "one slot left"). Never a discount — charter §3.4.

---

## SOP 02.6 — Weekly pipeline report

**TRIGGER** — Monday morning.

**OUTPUTS** — Internal report: new leads by source, conversations held, proposals out,
close rate, stale deals (no movement in 14 days), and **time-to-first-response**.

Lead source is the one that matters most. With no ad budget you're spending time
instead of money (`../../business/08-marketing-and-client-acquisition.md` §10), and this
is the only way to see which activity actually produces conversations.

---

## Templates

`templates/ack-enquiry.md` · `templates/followup-day-3.md` ·
`templates/followup-day-7.md` · `templates/followup-day-14.md`

All carry the charter §5 footer.
