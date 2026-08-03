# Sales pipeline — message templates

Every template ends with the charter §5 footer, verbatim:

```
—
This message was sent automatically by GivenTake Goods Devs.
Reply and a person will read it.
```

**Rules for all of them:** no price, no timeline, no availability, no invented urgency,
no personal signature. Substitutions are `{{field}}` from the `leads` record.

---

## ack-enquiry

**Sent:** within 1 hour in business hours, next business morning otherwise.

> **Subject:** Got your project brief
>
> Hi {{first_name}},
>
> Thanks for the details on {{project_shorthand}} — it came through and someone is
> reading it properly rather than skimming it.
>
> You'll hear back within one business day. If it turns out we're not the right
> people for this, we'll say so and point you somewhere better.
>
> In the meantime, if it's useful: our full process is at giventake.dev/process, and
> how we actually use AI to build things is at giventake.dev/how-we-use-ai. Both are
> longer and more specific than most studios put in public.

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
