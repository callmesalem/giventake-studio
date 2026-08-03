# 07 — Marketing operations

**The strategy is [`../../business/08-marketing-and-client-acquisition.md`](../../business/08-marketing-and-client-acquisition.md)**
— channel plan, why advertising comes later, the 90-day sequence. That document is not
superseded and not duplicated. This folder is the running layer: what happens each
week, who does it, and what gets tracked.

---

## ⚠️ The boundary that matters most

**Agents draft warm outreach. Agents do not send it.**

Warm network outreach is the highest-converting channel available to you, and it
converts *because it's personal*. The moment a message to someone who knows you is
machine-sent, the advantage is gone — and if they find out, you've spent trust you
can't easily rebuild.

This is the one place where automation makes the channel worse rather than faster.

| Agents may send | Human sends |
|---|---|
| Content publication | Every warm-network message |
| Review request follow-ups to existing clients | Referral partner outreach |
| Scheduled social/GBP posts | Anything to someone who knows you personally |
| Internal reports | Cold outreach (at least until a sequence is proven) |

---

## SOP 07.1 — Weekly warm outreach

**TRIGGER** — Monday.

**STEPS**
1. Agent selects 10 names from the outreach list who haven't been contacted.
2. Agent drafts a message per person, referencing something real about them or their
   business. Generic drafts are worse than none.
3. **Human reviews, edits, and sends from their own account.**
4. Agent logs the touchpoint and schedules one follow-up at day 10.

**DECISION RULES** — Never contact the same person twice in 90 days. Any reply removes
them from the automated queue entirely — a human takes the thread.

**PROHIBITIONS** — No sending. No bcc. No mail-merge appearance. If it looks
mail-merged, it has failed even if a human pressed send.

**Target from `business/08` §1:** ~80 messages → ~12 real conversations → 1–2 clients.

---

## SOP 07.2 — Referral partners

Accountants, bookkeepers, MSPs, and agencies who get asked for a developer and have no
good answer. `business/08` §2 explains why this is the strongest channel for a
faceless brand: **the partner's vouch substitutes for the founder story you're not
telling.**

**STEPS** — Agent maintains the partner list and drafts the outreach; human sends.
Agent tracks referrals received, outcomes, and **reports the outcome back to the
partner every time.**

**DECISION RULE** — A partner who refers and never hears what happened stops referring.
The report-back is not optional courtesy; it's the mechanism.

**Target:** 20 approached, 3 real relationships.

---

## SOP 07.3 — Content production

Two pieces a month, per `business/08` §5.

**STEPS**
1. Agent proposes topics from the buyer-question list and current search interest.
2. Agent drafts.
3. **Human edits substantively.** Not a rubber stamp — an unedited agent draft reads
   like one, and the whole value of this content is that it sounds like someone who
   has actually done the work.
4. Human approves → agent publishes to `src/lib/articles.ts` and the route, updates
   the sitemap, and logs it.

**PROHIBITIONS — the truthfulness rules apply in full** (charter §6, and the header
comment in `src/lib/articles.ts`):
- No outcome metrics from work not delivered
- No invented client anecdotes — "a business with five spreadsheets," never "a client
  of ours"
- No headcount claims
- Cost and time figures are market ranges with the reasoning shown, never claimed
  results

**The published articles deliberately include the case where the answer is "don't hire
a developer."** That's what makes the rest credible. Keep it.

---

## SOP 07.4 — Google Business Profile and reviews

Free, faceless-compatible, and the main trust substitute when there's no founder story
(`business/08` §3, §8).

**STEPS** — Agent drafts posts monthly; human approves. Agent tracks review requests
sent at handoff and follows up **once**.

**PROHIBITIONS** — Never incentivise a review. Never draft the text of a review for a
client. Both are prohibited by the FTC's Consumer Reviews and Testimonials Rule and
both are the same failure category as the fabricated case studies.

---

## SOP 07.5 — Weekly marketing report

**OUTPUTS** — Outreach sent · replies · conversations booked · partner activity ·
content published · reviews collected · **lead source for every enquiry** · time spent
per channel versus conversations produced.

That last pair is the decision-making number. With no ad budget you are spending time
instead of money, so the only meaningful question is which activity produced
conversations (`business/08` §10).

---

## The failure mode to watch

From `business/08` §10, worth repeating because it's the likeliest way this goes wrong:

> Spending three months on content and SEO because it feels productive and avoids
> rejection, while the warm list sits untouched.

Content compounds slowly. Outreach converts now. **If a week's report shows content
published and zero outreach sent, that's the signal** — and it's exactly the kind of
comfortable substitution that having agents makes easier, because drafting is
delegable and the uncomfortable part isn't.
