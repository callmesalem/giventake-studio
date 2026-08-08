# Statement of Work — TEMPLATE

> [!WARNING]
> **DRAFT — NOT FOR USE WITHOUT ATTORNEY REVIEW.** Not legal advice.

> [!TIP]
> **The SOW is the document that prevents disputes**, more than the MSA is.
> Almost every small-studio conflict traces back to one of three things: scope
> that was never written down, "done" that was never defined, or a change that
> was agreed in chat and never priced. Sections 3, 5, and 8 exist for exactly
> those three. Do not shorten them to close a deal faster.

---

**STATEMENT OF WORK #`[NUMBER]`**

Issued under the Master Services Agreement dated `[MSA DATE]` between
**`[GivenTake Devs LLC]`** ("Developer") and
`[CLIENT LEGAL NAME]` ("Client").

The MSA is incorporated by reference. Capitalised terms not defined here have the
meanings given in the MSA.

|                                          |                        |
| ---------------------------------------- | ---------------------- |
| **SOW number**                           | `[NUMBER]`             |
| **Project name**                         | `[PROJECT NAME]`       |
| **Effective date**                       | `[DATE]`               |
| **Target completion**                    | `[DATE]`               |
| **Client contact (authorised approver)** | `[NAME, TITLE, EMAIL]` |
| **Developer contact**                    | `[NAME, EMAIL]`        |

---

## 1. Background and objective

`[Two or three sentences: what the Client does, what problem this project solves,
and what success looks like in the Client's own terms. This section is not
decorative — it is what a third party reads first if there is ever a dispute
about what the project was for.]`

## 2. Services

Developer will:

1. `[Specific activity]`
2. `[Specific activity]`
3. `[Specific activity]`

## 3. Deliverables

| #   | Deliverable                                    | Format                      | Target date |
| --- | ---------------------------------------------- | --------------------------- | ----------- |
| 1   | `[e.g. Responsive marketing site, 6 pages]`    | `[Deployed site + repo]`    | `[DATE]`    |
| 2   | `[e.g. CMS with editor access for 3 users]`    | `[Deployed + docs]`         | `[DATE]`    |
| 3   | `[e.g. Handoff documentation and walkthrough]` | `[Written + recorded call]` | `[DATE]`    |

Every project also includes, per the studio's published commitments:

- Source code and repository access
- Deployment and handoff walkthrough
- Written documentation of how the system works
- Automated tests covering the critical paths identified in Section 5
- A software bill of materials and licence scan report

## 4. Out of scope

> **Fill this in properly.** An explicit exclusion list prevents more disputes
> than any other part of the document, because it converts an assumption into a
> conversation _before_ the invoice.

The following are **not** included and require a Change Order:

- `[e.g. Content writing and copywriting]`
- `[e.g. Photography, illustration, or licensed stock assets]`
- `[e.g. Migration of legacy data]`
- `[e.g. Third-party subscription costs — hosting, domains, APIs, email]`
- `[e.g. SEO strategy beyond technical fundamentals]`
- `[e.g. Native mobile applications]`
- `[e.g. Training beyond the handoff walkthrough]`
- `[e.g. Integrations not listed in Section 2]`
- Anything not expressly listed in Sections 2 and 3

## 5. Acceptance criteria

A Deliverable is complete when it meets the criteria below. These are the
standard against which material defects are assessed under MSA Section 7.

| Deliverable | Acceptance criteria                                                                                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1           | `[Objective, testable. e.g. "All 6 pages render correctly on current Chrome, Safari, Firefox and Edge, at 375px, 768px and 1440px widths; Lighthouse accessibility score ≥ 90; contact form delivers to the designated inbox."]` |
| 2           | `[e.g. "Three named users can log in, create, edit and publish a post without developer assistance."]`                                                                                                                           |

**Critical paths requiring automated test coverage:**

- `[e.g. Contact form submission and delivery]`
- `[e.g. Authentication and session handling]`
- `[e.g. Payment flow, end to end]`

Client has `[10]` business days from delivery to accept or give written notice of
a material defect. Silence, or use in production, constitutes acceptance.

## 6. Timeline and dependencies

| Phase                            | Duration   | Client dependency                                      |
| -------------------------------- | ---------- | ------------------------------------------------------ |
| Discovery and scope confirmation | `[X days]` | Kickoff call, access to systems                        |
| Design and structure             | `[X days]` | Brand assets, content, approval within 5 business days |
| Build                            | `[X days]` | Availability for weekly demo                           |
| Testing and revisions            | `[X days]` | Consolidated feedback within 5 business days           |
| Launch and handoff               | `[X days]` | Domain/DNS access, go-live approval                    |

**Timeline assumptions.** The dates above assume Client meets the dependencies
listed and responds within `[5]` business days. Delays beyond that extend the
timeline day for day. This is not a penalty — it is the only way a fixed date can
be honest when half the inputs are outside Developer's control.

**Revision rounds included:** `[N]`. A round means one consolidated set of
feedback, not individually submitted items over several days.

**Weekly demos** will be held `[day]` at `[time]`.

## 7. Fees and payment schedule

**Total fee: `$[AMOUNT]`** `[fixed fee / monthly retainer]`

| Milestone                        | Amount           | Due                     |
| -------------------------------- | ---------------- | ----------------------- |
| Deposit — due before work begins | `$[X]` (`[50]%`) | On signature            |
| `[Midpoint milestone]`           | `$[X]` (`[25]%`) | On milestone completion |
| On acceptance                    | `$[X]` (`[25]%`) | On acceptance per §5    |

**Tax treatment — [REVIEW with CPA]:**

| Line item                              | Description     | Amount | Sales tax            |
| -------------------------------------- | --------------- | ------ | -------------------- |
| Custom development                     | `[description]` | `$[X]` | `[exempt / taxable]` |
| Hosting, maintenance, ongoing services | `[description]` | `$[X]` | `[exempt / taxable]` |

> Ohio treats custom software differently from data processing, computer
> services, and electronic information services, and the distinction turns on the
> "true object" of the transaction. **Development and ongoing services must be
> separately stated and separately priced** on both this SOW and the invoice — a
> bundled figure invites an auditor to tax the whole amount. See
> [`../business/02-ohio-tax.md`](../business/02-ohio-tax.md).

**Third-party costs.** Hosting, domains, APIs, model usage, and subscriptions are
Client's responsibility and are billed at cost or paid directly by Client.
Estimated recurring: `$[X]/month`.

Payment terms are per MSA Section 5.

## 8. Change orders

Any change to scope, deliverables, timeline, or fees requires a written Change
Order signed by both Parties.

**No verbal request, email, or chat message changes this SOW.** Developer will
provide the fee and schedule impact of a requested change before performing it.

Change Order rate for work outside this SOW: `$[RATE]/hour` or a fixed quote per
change, at Developer's option.

## 9. Post-launch support

**Support window: `[N]` days** from acceptance.

**Included:** correction of defects in the Deliverables against the Section 5
acceptance criteria; minor content and configuration adjustments.

**Not included:** new features, third-party breakage outside Developer's control,
changes arising from Client-side modifications, or ongoing maintenance. These are
available under a retainer SOW or a Change Order.

## 10. AI-assisted delivery

Developer will use AI coding agents in performing this SOW, as described in MSA
Section 3 and the AI Use Disclosure provided with this SOW.

**Client restrictions on AI processing:** `[none / describe]`

**Personal or regulated data involved:** `[none / describe — if yes, a DPA is
required before work begins]`

## 11. Assumptions

- `[e.g. Client provides all copy and images by the discovery phase end date]`
- `[e.g. Existing brand guidelines will be followed; no new brand development]`
- `[e.g. Site will be deployed to Client's account, which Client controls]`
- `[e.g. One design direction is presented, refined through the included rounds]`

---

**AGREED:**

| **`[GivenTake Devs LLC]`** | **`[CLIENT LEGAL NAME]`**               |
| ----------------------------------------------------- | --------------------------------------- |
| Signature: ****\*\*****\_\_****\*\*****               | Signature: ****\*\*****\_\_****\*\***** |
| Name: `[NAME]`                                        | Name: `[NAME]`                          |
| Date: ****\*\*****\_\_****\*\*****                    | Date: ****\*\*****\_\_****\*\*****      |

---

## Change Order form

**CHANGE ORDER #`[N]` to SOW #`[NUMBER]`**

|                        |                                         |
| ---------------------- | --------------------------------------- |
| **Change requested**   | `[description]`                         |
| **Requested by**       | `[name, date]`                          |
| **Impact on scope**    | `[description]`                         |
| **Impact on timeline** | `[+X days]` — revised target `[DATE]`   |
| **Impact on fee**      | `$[X]` — revised total `$[X]`           |
| **Payment**            | `[with next milestone / on completion]` |

All other terms of the SOW and MSA remain unchanged.

| Developer                               | Client                                  |
| --------------------------------------- | --------------------------------------- |
| Signature: ****\*\*****\_\_****\*\***** | Signature: ****\*\*****\_\_****\*\***** |
| Date: ****\*\*****\_\_****\*\*****      | Date: ****\*\*****\_\_****\*\*****      |
