# 10 — Discovery question bank

**Open this during the call.** Core set for every client, then the module for
their business type, then the module for what they're building.

Process context: [09-client-process.md](./09-client-process.md) Stage 2.
Notes template: [`../templates/discovery-notes.md`](../templates/discovery-notes.md).

---

## Three rules that matter more than the questions

**1. Ask for the last concrete instance, not the general description.**

> ❌ "How does your intake process work?"
> ✅ "Walk me through the last enquiry that came in. What happened first?"

The first question gets you the tidy version they wish were true. The second gets
you the sticky notes, the group text, and the spreadsheet only one person
understands. Every useful thing you learn comes from the second question.

**2. Quantify everything.** Frequency, duration, headcount, cost of failure.
This qualifies the budget, gives you the ROI argument that justifies the price,
and captures the baseline that makes an honest case study possible later.

**3. Don't design on the call.** When you hear the problem you'll want to say
"we could just build X." Don't. You anchor yourself to a solution before you
understand the problem, and the client now expects that solution at whatever
number you said. Say: "let me think about the right approach and come back with
options."

**Silence is a tool.** After they finish an answer, wait. The second thing they
say is usually the real one.

---

# Part A — Core set (every client)

## A1. Business context

1. What does the business do, and how does it make money?
2. How many people, and who does what?
3. Who are your customers, and how do they find you?
4. **What changed recently that made this a problem worth solving now?**
   *(The "why now" — if there's no good answer, there's often no real budget
   behind it either.)*

## A2. The process walkthrough — most important section

5. **"Walk me through the last time [the thing] happened, from the very start."**
6. Who touches it, and in what order?
7. Where does the information live at each step? Spreadsheet, email, paper,
   someone's head?
8. What part breaks most often?
9. What workaround have people invented to cope with it?
10. What happens when the person who normally does this is away?
11. What do you personally end up doing that you shouldn't have to?

*Question 9 is where you find the real requirement. People build workarounds
around the thing that actually hurts.*

## A3. Quantify — the money section

12. How often does this happen? Per day, week, month?
13. How long does it take each time?
14. Who does it, and roughly what does that person's time cost?
15. What does it cost when it goes wrong — a missed lead, a no-show, a refund, a
    rework?
16. What would you do with that time if you got it back?

**Write these numbers down.** They become the Stage 5 baseline and the case study.

## A4. What success looks like

17. If this works, what's different 90 days from now?
18. **How will you know it worked? What number moves?**
19. What would make you look back and say this was a waste of money?

*Question 19 surfaces fears you can address in the proposal — usually "it'll be
late," "I won't be able to use it," or "I'll be locked in."*

## A5. Constraints and reality

20. What systems does this have to talk to? Accounting, payments, CRM, scheduling?
21. Who else will use it, and how comfortable are they with software?
22. Is there anything regulated involved — customer financial details, health
    information, anything industry-specific?
23. Who owns this decision? Is there anyone who could veto it?
24. What budget range are you working with, and where does it come from?
25. What's driving the timeline? What happens if it's two weeks later?

## A6. Fit and risk

26. Have you worked with a developer before? How did it go?
    *(Listen for what they contributed to it going badly. Also tells you which
    expectations you're inheriting.)*
27. Who'll be my main contact, and how much time can they give this each week?
28. If you get slammed with work mid-project, what happens to this?

---

# Part B — Business type modules

Pick the one that fits. These are the questions that make you sound like you've
seen their world before — which is what "specific to their niche" actually buys.

## B1. Trades, field service, restoration, contracting

- How do jobs come in — phone, text, referral, a portal?
- Who schedules, and what do they schedule with?
- How does the crew know where to go and what to do?
- How do photos and site documentation get back to the office?
- When does a job become an invoice, and how long does that take?
- Do you take deposits? How do you chase the balance?
- How do you know if a job was profitable — and when do you find out?
- What happens when a customer changes their mind on site?
- How do you handle materials, ordering, and receipts?
- Who follows up for a review after the job?

## B2. Professional services (agencies, consultants, accountants, advisors)

- How does a new enquiry become a client?
- How do you produce proposals, and how long does each take?
- How do you collect documents and information from clients?
- Where does client work-in-progress live?
- How do you track time, and how does that become an invoice?
- How do clients check on status? How often do they ask?
- What approval steps exist, and where do they stall?
- What do you re-key from one system into another?

## B3. Claims, insurance-adjacent, restoration documentation

- What triggers a file being opened?
- What documentation has to be assembled, and to whose standard?
- How do you track deadlines, and what happens if one is missed?
- How does communication with carriers or adjusters happen and get recorded?
- How is photo and evidence documentation organised?
- How do you know the current status of every open file?
- What has to be retained, and for how long?
- Where do files get stuck?

## B4. E-commerce and product

- Where do you sell, and do those channels talk to each other?
- How is inventory tracked, and how often is it wrong?
- What happens between an order and a shipment?
- How are returns handled?
- How do you reorder from suppliers?
- What do you re-enter by hand between systems?

## B5. Anything regulated (health, financial, legal, government)

- What specific data are we handling?
- What regulation applies, and who inside the business owns compliance?
- Are there restrictions on where data can be stored or processed?
- Is there an existing security or vendor review process I'd go through?
- **Are there restrictions on third-party AI tools processing this?**

> ⚠️ **Escalate, don't improvise.** Regulated data changes the contract, the AI
> tooling, the insurance conversation, and the price. If HIPAA or similar comes
> up, that's a "let me come back to you" — not something to scope on the call.
> See [04-ai-delivery-policy.md](./04-ai-delivery-policy.md) §4.

---

# Part C — Project type modules

## C1. Internal tool or dashboard

- Who opens this, how often, and what decision are they making with it?
- What are they using instead today?
- Where does the data live now, and who owns it?
- How current does it need to be — live, hourly, daily?
- Who should see what? Does anyone need to be restricted?
- What's the one number that, if it were always visible, would change how you run?
- What happens to the old spreadsheets — replaced, or still needed?

## C2. AI agent or automation

**These questions are your genuine differentiator. Almost nobody asks them, and
they're exactly where AI projects fail.**

- What starts the process — an email, a form, a schedule, a person?
- What decision is the automation making, and what are the possible outcomes?
- **How often is a human wrong at this today?** *(Sets a realistic bar. Clients
  expect AI to be perfect while accepting human error daily — surfacing this
  early is the single most valuable reframe you can offer.)*
- **What's an acceptable error rate?** What's the cost of a wrong call?
- **What should happen when the system isn't confident?** Queue for review, take
  the safe default, or escalate?
- Who reviews the output, and how often?
- What's the fallback if it's unavailable?
- Does the customer need to know AI was involved?
- What edge cases do you already know about?

## C3. Website or marketing site

- What should a visitor do? What's the one action?
- What's failing with the current one — traffic, conversion, or you can't update it?
- Who needs to edit it, and how technical are they?
- Do you have brand assets and copy, or is that part of the work?
- Are we migrating an existing site? *(URLs and redirects — this is where SEO
  gets destroyed, and it's the most common expensive mistake.)*
- Any integrations — booking, payments, CRM, mailing list?

## C4. Booking, scheduling, or payments

- Who books today, and how?
- Deposits, full payment, or pay later?
- What's the cancellation and reschedule policy?
- How do reminders go out now?
- What calendars need to stay in sync?
- What happens on a no-show?
- Who handles refunds, and under what rules?

> **Never handle raw card data.** Use a hosted payment provider so card details
> never touch your systems — it keeps PCI scope minimal and is the correct answer
> for a studio this size.

## C5. MVP or new product

- Who are the first ten users, and can you name them?
- **What's the riskiest assumption — the one that, if wrong, means none of this
  matters?**
- What's the smallest thing that tests it?
- How will you get those first users?
- What does "it's working" look like in 90 days?
- What's the plan if it doesn't work?

*If they can't name ten prospective users, that's the real project. Say so.*

---

# Part D — Closing the call

29. What haven't I asked about that I should have?
30. What's your biggest concern about doing this?
31. What's your timeline for deciding?
32. What happens next on your side?

**Then, always:**

- Tell them exactly what happens next and when: *"I'll send a summary within 24
  hours and a proposal by [day]."*
- **Send the summary.** Ask "did I get this right?" It catches misunderstandings
  before they're priced in, and it demonstrates the process — which is the thing
  you're actually selling.
- **Do not send a number on the call or immediately after.** Nothing good comes
  from a price produced under social pressure.
