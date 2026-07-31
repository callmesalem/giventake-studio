# Delivery review checklist — `[CLIENT]` / `[RELEASE]`

**Reviewed by:** `[ ]` · **Date:** `[ ]` · **Commit / tag:** `[ ]`

> **Nothing ships without this.** The site publicly commits to "nothing ships
> without manual human review," which makes this a representation you have to be
> able to evidence. Complete it, commit it to the repo, and keep it.
>
> Standard: [`../business/04-ai-delivery-policy.md`](../business/04-ai-delivery-policy.md) §5.

---

## Code review

- [ ] **Every AI-generated file has been read by a human** — read, not skimmed
- [ ] Architecture still matches the plan; no drift introduced by generated code
- [ ] No dead code, stubbed functions, or `TODO`s left in shipped paths
- [ ] Error handling exists on every external call
- [ ] Naming and structure are consistent enough for someone else to maintain

## High-risk paths — line by line

**These are where negligence claims concentrate and where AI output is most
confidently wrong. Review them by hand, every release.**

- [ ] **Authentication** — login, sessions, password reset, token expiry
- [ ] **Authorization** — can user A reach user B's data? Test it, don't assume
- [ ] **Payments** — amounts, currency, idempotency, refunds, failure states
- [ ] **Data deletion** — does it delete what it claims, and nothing else?
- [ ] Anything touching personal or regulated data

## Tests

- [ ] Automated tests exist for the critical paths named in the SOW
- [ ] All tests pass
- [ ] Failure cases covered, not just the happy path
- [ ] Manually walked the primary user journey end to end

## Security

- [ ] **No secrets committed** — scan the repo history, not just the working tree
- [ ] Environment variables used for all credentials
- [ ] Input validation on anything user-supplied
- [ ] Dependency vulnerability scan run and clean, or exceptions noted
- [ ] Least-privilege access on all service accounts

## Licence and provenance

- [ ] **Licence / composition scan run** — result: `[ ]`
- [ ] **SBOM generated** and included in the handoff package
- [ ] No copyleft dependency that conflicts with the client's use
- [ ] Any flagged component raised with the client **before** delivery

## Accessibility and quality

- [ ] Keyboard navigable
- [ ] Sensible contrast and focus states
- [ ] Responsive at mobile, tablet, desktop
- [ ] Meaningful `alt` text on informational images

## Client-facing accuracy

- [ ] Nothing in the UI or copy claims something the system doesn't do
- [ ] Acceptance criteria from the SOW are each demonstrably met

---

## Exceptions

Anything not done, and why:

| Item | Reason | Client informed? |
|---|---|---|
| | | |

---

**Cleared to ship:** `[ ]` **Signature / initials:** `[ ]`
