# 09 — The client process

**One process, every client, every time.** This is the operating manual for how a
lead becomes a delivered project.

Questions live in [10-discovery-questions.md](./10-discovery-questions.md).
Fill-in templates live in [`../templates/`](../templates/).

---

## Why this is the differentiator

The AI angle is not defensible. Every studio will claim agentic delivery within a
year, and a buyer can't verify it anyway.

**A written, repeatable process is defensible**, because almost nobody in the
vibe-coding tier has one. The typical version of this business is: a call, a
vague quote, some enthusiastic building, a demo that isn't what the client
pictured, an awkward conversation about scope, and a project that limps to a
finish. That is the competition.

What a real process buys you, in order of value:

1. **Accurate scoping**, which prevents the disputes that kill small studios
2. **Consistent output**, because the same gates run on every project
3. **Premium pricing** — process is what a client is actually buying when they
   pay more than freelancer rates
4. **Referability** — partners refer a process, not a person
5. **Credibility without a face** — this matters specifically because of the
   faceless positioning in [08](./08-marketing-and-client-acquisition.md).
   A documented method is the trust substitute
6. **Real case studies** — the baseline you measure at kickoff is what makes an
   honest published metric possible later

That last one closes the loop on the problem that forced the site rewrite. You
can't publish "cut admin time 60%" unless you measured what it was. **Stage 5
is where that measurement happens**, and it is not optional.

---

## The pipeline

Eleven stages. Each has an entry condition, an artifact, and an exit gate. **Do
not skip a gate to move faster** — every gate exists because skipping it costs
more later.

| # | Stage | Artifact | Gate to pass |
|---|---|---|---|
| 0 | Lead arrives | Lead record | — |
| 1 | Qualify (10 min) | Qualification note | Budget and fit plausible |
| 2 | Discovery call (45–60 min) | Discovery notes | Problem understood, quantified |
| 3 | Scope | Proposal + SOW | — |
| 4 | Close | Signed SOW + deposit | **Signed and paid before any code** |
| 5 | Kickoff | Kickoff note + **baseline measured** | Access granted, baseline recorded |
| 6 | Build cycles | Weekly demo + written update | Client saw it working each week |
| 7 | Delivery review | Review checklist | **Nothing ships without it** |
| 8 | Acceptance | Written acceptance | Meets SOW criteria |
| 9 | Handoff | Handoff package | Client can operate it |
| 10 | Support window | Support log | Window expires or converts |
| 11 | Retro | Retro note + testimonial + metrics | Case study material captured |

---

## Stage 0–1: Lead and qualification

**Purpose: don't spend an hour on a call that was never going to work.**

A 10-minute screening call, or a short email exchange. Five things to establish:

1. What are they trying to build or fix?
2. **What happens if they do nothing?** — the single best qualifier. If the honest
   answer is "not much," there is no budget behind this
3. Is there a budget, and is it in range?
4. What's driving the timeline?
5. Who makes the decision?

**Exit gate:** budget plausibly in range and a real problem exists. If not, say so
directly and offer a referral. Declining well is worth more than a bad project —
people remember it and refer you anyway.

**Track the lead source.** With no ad budget you're spending time instead of
money, so knowing which channel produced the conversation is the only way to
allocate it ([08](./08-marketing-and-client-acquisition.md) §10).

---

## Stage 2: Discovery call

**45–60 minutes. Structured, not a chat.** Use
[10-discovery-questions.md](./10-discovery-questions.md): the core set for
everyone, plus the module for their business type and the module for what
they're building.

Three rules that matter more than the questions themselves:

- **Ask for the last concrete instance, not the general description.** "Walk me
  through the last time a job came in, start to finish" gets you the truth.
  "How does your intake work?" gets you the tidy version they wish were true.
- **Quantify everything.** Frequency, duration, who does it, what it costs when
  it goes wrong. This qualifies budget, gives you the ROI argument, and captures
  the baseline for a future case study.
- **Do not design on the call.** The instinct to say "oh, we could just build
  X" is strong and it costs you. You end up anchored to a solution before you
  understand the problem, and the client now expects that solution at that price.
  Say "let me think about the right approach and come back with options."

**Artifact:** [`../templates/discovery-notes.md`](../templates/discovery-notes.md),
completed same day while it's fresh. Send a summary to the client asking "did I
get this right?" — cheap, and it catches misunderstandings before they're priced.

**Exit gate:** you can describe their current process step by step, and you have
numbers on how often it happens and what it costs.

---

## Stage 3: Scope

For a small, clear project: go straight to a proposal.

For anything complex or ambiguous: **sell a paid discovery sprint**
($750–$1,500, credited against the build — see
[05](./05-pricing-and-positioning.md) §1). You are doing this work regardless;
the only question is whether you're paid for it. It also qualifies the client
hard — someone who won't pay $750 to define the problem won't pay $15,000 to
solve it.

**The proposal contains:**

- The problem in **their** words, from the discovery notes
- What you'll build, and explicitly what you won't
- Acceptance criteria — objective and testable
- Timeline with their dependencies marked
- Fixed price with the payment schedule
- What you need from them, and by when

**Rule: never quote on a call.** Nothing good comes from a number you produced
under social pressure.

---

## Stage 4: Close

**Signed SOW and cleared deposit before any code is written. No exceptions.**

This is the one rule most likely to be broken for a client who seems trustworthy
and is in a hurry. Breaking it is how studios end up building for free.

Documents: MSA (once per client) + SOW (per project), from
[`../contracts/`](../contracts/). Send the
[AI use disclosure](../contracts/ai-use-disclosure.md) alongside — leading with
it defuses the objection before the client raises it, and it makes you look like
the only serious vendor they've spoken to.

---

## Stage 5: Kickoff

- Confirm the single decision-maker and their availability
- Collect access: repos, hosting, domain, third-party accounts
- Set the weekly demo slot, in the calendar, recurring
- Agree the communication channel and expected response times
- Confirm no AI restrictions on their material (MSA §3.4)

### ⚠️ Measure the baseline — do not skip this

**Before anything is built, record the current numbers:**

- How long does the process take today?
- How often does it happen?
- What's the current error, no-show, or rework rate?
- How many people touch it?
- What's it costing?

Ten minutes at kickoff. It is the difference between a case study that says
"cut processing time from 6 hours a week to 30 minutes" and one that says
"clients like it." One of those wins you work.

Get it in writing, from the client, so it's their number rather than your claim.

---

## Stage 6: Build cycles

**Weekly rhythm, non-negotiable:**

- A **working demo** every week. Not a status update — something they can click.
  Weekly demos are the single strongest defence against "this isn't what I
  pictured," because the gap can only ever be one week wide
- A **written update**: what shipped, what's next, what you need from them,
  anything at risk
- Any scope change goes through a **written Change Order** before the work
  happens. Verbal and chat agreements do not change scope
  ([`../contracts/sow-template.md`](../contracts/sow-template.md) §8)

**If the client goes quiet:** note it in writing, and note the timeline impact.
Dependencies that slip are the most common cause of a late project, and the
record protects both sides.

---

## Stage 7: Delivery review gate

**Nothing ships without this.** It is the specific commitment made publicly on
the site ("nothing ships without manual human review"), so it is now a
representation you have to be able to evidence.

Run [`../templates/delivery-review-checklist.md`](../templates/delivery-review-checklist.md).
It covers the review standard in
[04-ai-delivery-policy.md](./04-ai-delivery-policy.md) §5: every AI-generated
file read by a human, auth/authorization/payment paths reviewed line by line,
tests passing on critical paths, licence scan and SBOM, no secrets committed,
dependency vulnerabilities checked.

**Keep the completed checklist in the repo.** That's what turns "we reviewed it"
into something demonstrable.

---

## Stage 8: Acceptance

Test against the SOW's acceptance criteria — the ones written in Stage 3, not a
new set invented now.

Client has 10 business days to accept or report a material defect in writing.
Defects against the criteria get fixed free. Anything beyond them is a change
request, and saying so calmly and immediately is the whole skill.

**Get acceptance in writing.** An email saying "this looks good" is enough.

---

## Stage 9: Handoff

The handoff package is what the site promises and what makes you hard to
replace *for the right reason* — the client stays because they want to, not
because they're locked in:

- Source code and repository access
- Deployed, working environment they control
- Written documentation of how the system works
- Recorded walkthrough (30 minutes, screen recording — reusable and saves the
  same call three times)
- SBOM and licence scan report
- Credentials transferred, and **your access removed or reduced** — then confirm
  in writing that you did it

Run [`../templates/handoff-checklist.md`](../templates/handoff-checklist.md).

---

## Stage 10: Support window

14 / 30 / 60 days depending on tier. Log every request: what it was, whether it
was a defect or a new request, and how long it took.

That log is your evidence for whether the support window is priced correctly. It
is also the natural opening for a retainer conversation — when requests keep
arriving after the window, the client has just demonstrated they need one.

---

## Stage 11: Retrospective

**Two weeks after handoff. This is where compounding happens.**

**Internal:**
- Estimated vs. actual hours. Where was the estimate wrong, and why?
- **Effective hourly rate** — the number that tells you whether the work was
  worth doing ([05](./05-pricing-and-positioning.md) §7)
- What broke? What would you do differently?
- Anything reusable to add to your own toolkit?
- **Update this process document** if you found a gap. That's how it improves

**With the client:**
- **Re-measure the baseline numbers from Stage 5.** This is the case study
- Ask for a testimonial while they're happiest
- Ask for a Google review — your main trust asset with a faceless brand
- Ask for referrals: "who else do you know with this problem?"
- Raise the retainer if the work is ongoing

**Then, and only then:** write the case study, with real numbers and written
permission to publish. That's how the site's "example builds" section eventually
becomes a real one.

---

## Red flags — when to walk away

Reasons to decline, or to price for the risk:

- **Can't describe their own current process.** If they can't tell you how it
  works today, no scope you write will survive contact with reality
- **No single decision-maker**, or a silent partner who appears late
- **Budget mismatch** they won't discuss
- **"It should be simple."** Sometimes true. Usually means they haven't thought
  about it and will be surprised by the price and the timeline
- **Wants a fixed price on undefined scope** and won't pay for discovery
- **The last developer "was terrible"** with no specifics. Sometimes true. Often
  the client. Ask what happened in detail and listen for what they contributed
- **Regulated data** — health, financial, government — that surfaced late. Not a
  no, but it changes the contract, the AI tooling, and the price
- **Deadline driven by an immovable external event** with no slack. The risk is
  entirely yours and the upside isn't

Declining a bad project is a business decision, not a failure. The cost of a bad
client is not the lost revenue — it's the months of good work you couldn't take
because you were trapped.

---

## What makes this consistent

Every project produces the same artifacts, in the same order:

```
Qualification note → Discovery notes → Proposal + SOW → Kickoff note (+ baseline)
  → Weekly updates → Review checklist → Written acceptance → Handoff package
  → Support log → Retro note (+ measured results)
```

**Keep them together per client**, in one folder or one CRM record. When a
client comes back in eight months, or a dispute arises, or you want to write the
case study, everything is in one place.

That is the system. Its value is not any single document — it's that it runs the
same way every time, so the output doesn't depend on how you felt that week.
