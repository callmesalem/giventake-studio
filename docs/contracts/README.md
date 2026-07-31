# Contract templates

> [!IMPORTANT]
> **These are drafting starting points, not finished contracts, and I am not a
> lawyer.** They exist so that your consultation with an Ohio business attorney
> is a review rather than a blank page — that should save you most of the
> billable hours, but not all of them, and the difference matters.
>
> **Do not sign a client to any of these before an attorney has reviewed them.**
> A template you didn't have reviewed gives a false sense of security, which is
> worse than knowing you have no contract.

| Document                                       | Purpose                                                 |
| ---------------------------------------------- | ------------------------------------------------------- |
| [msa-template.md](./msa-template.md)           | Master Services Agreement — signed once per client      |
| [sow-template.md](./sow-template.md)           | Statement of Work — signed per project                  |
| [ai-use-disclosure.md](./ai-use-disclosure.md) | Client-facing explanation of AI-assisted delivery       |
| [ai-tool-register.md](./ai-tool-register.md)   | Internal record substantiating the "no training" claim  |
| [subprocessor-list.md](./subprocessor-list.md) | Processors, as required by the published privacy policy |

## How these fit together

```
MSA  ──────────────►  signed once per client; the legal framework
 │
 ├── SOW #1  ───────►  scope, price, timeline for one project
 ├── SOW #2  ───────►  a second project, same MSA
 └── Change Order ──►  amends a specific SOW
```

The MSA holds the terms that don't change between projects (IP, liability,
confidentiality, AI disclosure, governing law). The SOW holds everything that
does (scope, price, dates, acceptance). This split is what lets you sell a second
project with a one-page document instead of a fresh negotiation.

## The clauses to spend attorney time on

Not all clauses are equal. If budget is limited, direct the attorney here:

1. **IP assignment and the AI warranty carve-out.** The standard "Developer
   warrants the Deliverables are original works" is likely false for
   AI-generated code, and it is the warranty a client would rely on. See
   [`../business/04-ai-delivery-policy.md`](../business/04-ai-delivery-policy.md) §2.
   This is the highest-value hour you will buy.
2. **Limitation of liability**, aligned to your actual insurance limit.
3. **The change-order clause.** This single clause prevents most scope disputes,
   which are the most common source of small-studio claims.
4. **Ohio governing law and venue**, and whether to add arbitration.

## Before first use

- [ ] Fill every `[BRACKETED]` placeholder
- [ ] Confirm the liability cap matches your bound E&O limit
      → [`../business/03-insurance-and-risk.md`](../business/03-insurance-and-risk.md)
- [ ] Attorney review
- [ ] Set up e-signature so signing isn't a friction point
