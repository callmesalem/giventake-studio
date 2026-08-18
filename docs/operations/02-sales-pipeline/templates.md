# Sales pipeline — message templates

Every template ends with the charter §5 footer, verbatim:

```
—
This message was sent automatically by GivenTake Devs.
Reply and a person will read it.
```

**Rules for all of them:** no price, no timeline, no availability, no invented urgency,
no personal signature. Substitutions are `{{field}}` from the `leads` record.

---

## ack-enquiry

**Sent:** within 1 hour in business hours, next business morning otherwise.

> **Decision (2026-08-18):** this warmer welcome copy is the standard website-form
> auto-reply, replacing the earlier "Got your project brief" acknowledgement.
> Guardrails unchanged: no specific price/timeline/availability, the charter §5
> footer is required verbatim, and it sends as the studio with no personal
> signature. Wired into the intake flow (`src/lib/lead-autoreply.ts`, rendered from
> `submitContact` in `src/lib/intake.ts`) but **dormant** — it sends nothing until
> the Resend domain is verified and `LEAD_AUTOREPLY_ENABLED` is turned on.

> **Subject:** Welcome to GivenTake Devs, let's turn that into something built
>
> Hi {{first_name}},
>
> Thanks for reaching out to GivenTake Devs. We build software for businesses:
> websites, web apps, internal tools, automations, and AI, without you having to
> hire and manage a dev team.
>
> Here is how we work:
> - You tell us the problem or the idea.
> - A short discovery call to understand your business and what "done" looks like.
> - A clear proposal covering scope, timeline, and price, before any work begins.
>
> Our model is simple: you bring the problem, we figure out the technology and
> build the solution. Think of us as your on-demand development team.
>
> —
> This message was sent automatically by GivenTake Devs.
> Reply and a person will read it.

---

## followup-day-3

> **Subject:** Re: your proposal
>
> Hi {{first_name}},
>
> Following up on the proposal sent {{sent_date}} — just checking it arrived and
> opened properly.
>
> No rush on a decision. If anything in the scope or the exclusions isn't clear,
> that's worth sorting out before you decide rather than after.

---

## followup-day-7

> **Subject:** Anything I can clarify?
>
> Hi {{first_name}},
>
> Still happy to answer questions on the proposal — particularly about what's *not*
> included, which is usually where the real questions are.
>
> If the timing isn't right, that's a completely fine answer. Just say so and we'll
> leave it.

---

## followup-day-14

**The last one. No further automated contact after this.**

> **Subject:** Closing the loop
>
> Hi {{first_name}},
>
> I'll stop chasing after this one — you've got enough email.
>
> The proposal stands if you want to pick it up later, and the scope in it will still
> make sense in a few months. If something changed or it's just not a priority now,
> no explanation needed.
>
> Good luck with {{project_shorthand}} either way.

---

## Notes on tone

The follow-ups deliberately give the client permission to say no. That isn't
politeness for its own sake — a clean "not now" is more useful than a silence you keep
chasing, and it's the difference between being remembered well and being remembered as
the studio that wouldn't stop emailing.

**No pressure tactics.** No fake scarcity, no expiring discount, no "last chance."
Beyond being unpleasant, an automated message inventing urgency is a false statement
sent at scale, which is exactly the failure mode charter §6 exists to prevent.
