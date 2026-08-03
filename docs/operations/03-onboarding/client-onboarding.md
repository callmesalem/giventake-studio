# Client onboarding — day 0 to day 30

**TRIGGER** — Countersigned SOW **and** cleared deposit. Not one or the other.
`../../business/09-client-process.md` stage 4 is unambiguous: nothing starts before
both.

---

## The sequence

| When | What | Who |
|---|---|---|
| Day 0 | Welcome packet, client record created, kickoff booked | Agent |
| Day 1 | Access request list sent | Agent |
| Day 2 | Comms charter sent | Agent |
| Day 3 | Access chase #1 if outstanding | Agent |
| Day 5 | **Kickoff call + baseline measurement** | **Human** |
| Day 5 | Kickoff summary drafted → human sends | Agent → Human |
| Day 7 | First weekly demo | Human |
| Day 14 | Checklist audit — anything still missing gets escalated | Agent |
| Day 30 | Check-in drafted → human sends | Agent → Human |

---

## SOP 03.1 — Welcome packet (day 0)

**INPUTS** — Signed SOW, client contact, project name, agreed kickoff window.

**STEPS**
1. Create the `clients` and `projects` rows. **Record `ai_restrictions` from MSA §3.4
   now** — before any operator touches this client's material (charter §7).
2. Create the client folder per `../../templates/README.md`.
3. Send the welcome packet:
   - What happens next, with dates
   - Who to contact and how (links the comms charter)
   - What we need from them, and by when
   - Their copy of the signed SOW and MSA
   - The AI use disclosure, again — it went with the proposal, it goes again here
   - Links to `/process` and `/how-we-use-ai`
4. Send the scheduling link for kickoff. Target: **within 5 business days of signature.**

**DECISION RULES** — No kickoff booked within 5 business days → escalate. A client who
can't find an hour in week one is telling you something about the whole project.

**PROHIBITIONS** — Never restate scope, price, or dates from memory or from a similar
project. Copy them from the signed SOW or don't include them.

---

## SOP 03.2 — Access and credentials (day 1, chase day 3)

**⚠️ The security-sensitive step.** Getting this wrong is how a project starts with a
credential in an email thread that lives forever.

**STEPS**
1. Send the access request list — only what the SOW actually needs, nothing
   speculative.
2. **Specify the transfer method.** Credentials never arrive by plain email or chat.
   See [08-security-incident](../08-security-incident/) for the accepted channels.
3. Track each item: requested → received → verified.
4. Chase outstanding items on day 3, then day 7. Two chases, then escalate.

**DECISION RULES**
- Client sends a credential by insecure channel → **escalate immediately**, tell them
  to rotate it, and record it. Do not simply use it.
- Access missing at day 7 → escalate. This is the most common cause of a late project,
  and the timeline consequence needs to be said out loud early, in writing.

**PROHIBITIONS** — Agents never store credentials in operator context, logs, or the
client record (charter §7). They track *whether* an item arrived, never its value.

---

## SOP 03.3 — Comms charter (day 2)

Sets expectations in writing, so they're a shared agreement rather than a later
argument. Sent once, referenced whenever it slips.

Contents:

- **Channel** — one primary channel. Not email *and* chat *and* text.
- **Our response time** — one business day.
- **Your response time** — five business days, and what happens when it slips:
  timelines move day for day. Not a penalty; the only way a fixed date stays honest
  when half the inputs are outside our control.
- **The weekly demo** — day and time, recurring, in the calendar.
- **Who decides** — one named person with authority over scope and sign-off.
- **How scope changes work** — written change order, priced, before the work.
  Never a chat message. (`../../contracts/sow-template.md` §8)
- **Escalation** — how to raise something urgent, and what counts as urgent.

**DECISION RULES** — More than one named decision-maker → escalate. Two people with
veto power and no tiebreaker is the single most reliable predictor of a project that
stalls.

---

## SOP 03.4 — Kickoff and baseline (day 5) — **human-run**

The call is the human's. The agent prepares the pack and captures the output.

**Agent prepares:** agenda, discovery notes, SOW summary, access status, open questions.

**Human runs the call:**
1. Confirm the decision-maker and their availability.
2. Confirm no AI restrictions beyond what's recorded.
3. Walk the timeline and the client-side dependencies.
4. Confirm what "done" looks like against the SOW's acceptance criteria.
5. **Measure the baseline.**

### The baseline measurement

Ten minutes. Recorded in `projects.baseline_json`, and confirmed back to the client in
writing so it's *their* number rather than our claim.

| Measure | Capture |
|---|---|
| How long the current process takes | Minutes or hours per occurrence |
| How often it happens | Per day / week / month |
| Who does it | Role, and roughly what their time costs |
| Current error / rework / no-show rate | Percentage or count |
| What it costs when it goes wrong | Dollars, or hours |
| People involved | Count |

**If the client doesn't know**, that is itself the finding — and worth saying plainly:
you can't tell whether this project worked if nobody knows what "before" looked like.
Help them get a rough number. A defensible estimate beats nothing.

**Agent after the call:** draft the kickoff summary including the baseline table, hold
for human review, send on approval. Set the day-14 and day-30 reminders.

---

## SOP 03.5 — Day 14 checklist audit

**STEPS** — Verify: all access received and verified · weekly demo held at least once ·
baseline recorded · comms charter acknowledged · decision-maker confirmed · no
unlogged scope conversations.

**DECISION RULES** — Any item outstanding → escalate with the specific gap named. This
is a quiet checkpoint that catches the things which are cheap to fix at day 14 and
expensive at day 40.

---

## SOP 03.6 — Day 30 check-in

**STEPS** — Draft a short check-in: progress against plan, anything needed from them,
an open question about how the working relationship feels. Human reviews and sends.

**DECISION RULES** — Any dissatisfaction signal in the reply → escalate immediately and
open the at-risk playbook ([05-retention](../05-retention/)). Month one is when a bad
engagement is still cheap to fix.

**PROHIBITIONS** — Never ask for a testimonial or referral at day 30. Nothing has been
delivered. The ask belongs at handoff, per [05-retention](../05-retention/).

---

## Onboarding checklist

- [ ] Signed SOW and cleared deposit
- [ ] `clients` + `projects` rows created; **`ai_restrictions` recorded**
- [ ] Client folder created
- [ ] Welcome packet sent (incl. AI use disclosure)
- [ ] Kickoff booked within 5 business days
- [ ] Access requested, received, **verified**, transferred securely
- [ ] Comms charter sent and acknowledged
- [ ] Single decision-maker confirmed
- [ ] Weekly demo recurring in the calendar
- [ ] **Baseline measured and confirmed in writing by the client**
- [ ] Kickoff summary sent
- [ ] Day 14 audit passed
- [ ] Day 30 check-in sent
