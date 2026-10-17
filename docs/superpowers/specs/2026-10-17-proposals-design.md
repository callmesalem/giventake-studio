# Proposals: price book, guided scoping, and client acceptance

Status: design approved in conversation, 2026-10-17. Awaiting spec review.

## 1. Why

GivenTake Devs needs to run a client from lead to review/referral. The first
and least-certain step is **scoping and pricing**: today a deal's price is one
hand-typed `deals.value_usd`, there is no line-item or price-book model, and
the SOW's fee table is filled by hand. This project adds a consistent way to
decide what goes into a job, price it from fixed building blocks, present it as
a **proposal** (the site promises "a written quote and proposal before any work
starts"), and hand the accepted proposal to the SOW.

Later projects, each with its own design: prospecting and qualifying (budget,
decision-maker, cost of doing nothing, timeline on the deal); delivery
workspace (stages 5–9); review and referral loop (stages 10–11).

## 2. Decisions (from the owner)

| Topic | Decision |
|---|---|
| Name | "Proposal" everywhere, CRM and client page |
| Pricing model | Price book of building blocks, prices ending in 9 |
| Price book home | Editable page in the CRM; proposals snapshot prices |
| Scoping | Guided questionnaire is the default; manual add/edit always available |
| Delivery | Private web link with Accept button, plus PDF |
| Payment | Client chooses among the eligible options when accepting |

Assumptions accepted with the design:

- A proposal is a priced offer, **not the contract**. The SOW stays binding;
  accepting a proposal does not move the deal to stage 4 (that gate still
  requires a signed SOW).
- Payment options: paid in full; 50/25/25 (50% to start, 25% at build review,
  25% at launch); own-it plan ($0 down, $149/mo × 12), offered only when the
  one-time total is ≤ $1,788. The own-it price is always 12 × $149 = $1,788,
  whatever the one-time total; it is the price of paying nothing upfront.
  Monthly lines (hosting, care) are billed on top in every option.
- Proposals are valid 30 days after sending by default.

## 3. Price book

Table `price_book_items`:

| Column | Notes |
|---|---|
| `id` uuid | |
| `key` text unique | stable internal key used by scoping rules, e.g. `extra_page` |
| `name`, `description` text | client-facing |
| `category` text | `website` \| `addon` \| `automation` \| `monthly` |
| `unit` text | `each` \| `page` \| `town` \| `month` |
| `unit_price_cents` bigint | ≥ 0 |
| `recurring` boolean | true for monthly items |
| `price_is_from` boolean | shows "from" (e.g. automation build) |
| `includes`, `excludes` text[] | flow into proposal and SOW |
| `internal_hours` numeric null | never shown to clients; drives effective rate |
| `archived` boolean | hidden from new proposals, kept on old ones |
| `sort_order` int | |

Seed (editable afterwards):

| key | Item | Price |
|---|---|---|
| `site_standard` | Standard website: up to 5 pages, CMS, mobile-first, SEO basics, analytics, 30 days of tweaks | $999 |
| `site_contractor` | Contractor website: standard + tap-to-call, quote form, service-area section, job gallery, local schema, Google profile links | $1,999 |
| `extra_page` | Extra page | $149 / page |
| `town_page` | Town / service-area page | $99 / town |
| `copywriting` | Copywriting | $149 / page |
| `quote_form` | Quote form with photo upload | $199 |
| `booking_embed` | Booking embed (Calendly-style) | $249 |
| `online_payments` | Online payments (Stripe checkout) | $399 |
| `site_replacement` | Replace an existing site (redirects mapped) | $299 |
| `gbp_setup` | Google Business Profile setup | $199 |
| `blog_setup` | Blog setup | $299 |
| `automation_audit` | Automation audit, credited toward the build within 30 days | $749 |
| `automation_build` | Automation build, one process | from $3,999 |
| `hosting` | Hosting only | $49 / mo |
| `care_plan` | Care plan | $99 / mo |
| `automation_retainer` | Automation retainer | from $499 / mo |

Custom lines (any text, any price) are allowed on proposals and are how custom
booking systems, dashboards, AI lead intake and MVPs are priced.

Screen: `/crm/price-book`, admin-edit, list grouped by category, create/edit
form, archive toggle.

## 4. Guided scoping

Answers are stored on the deal (`deals.scoping` jsonb, written through an RPC)
so they can be revisited and later feed SOW deliverables. A **Scope** card on
the deal page holds the questionnaire.

| Question | Answer type | Suggests |
|---|---|---|
| Trade / home-service business? | yes/no | `site_contractor`, else `site_standard` |
| Replacing an existing site? | yes/no | `site_replacement` |
| Pages beyond the included 5 | number | `extra_page` × n |
| Towns that need their own page | number | `town_page` × n |
| Who writes the words? | client / us | `copywriting` × (5 + extra pages) when "us" |
| Quote form with photos? (standard sites only) | yes/no | `quote_form` |
| Booking | none / embed / full system | `booking_embed`, or a custom line flagged "quote after discovery" |
| Online payments? | yes/no | `online_payments` |
| Google Business Profile already set up? | yes/no | `gbp_setup` when no |
| Blog? | yes/no | `blog_setup` |
| Repetitive process eating their time? | yes/no | `automation_audit` |
| After launch | nothing / hosting / care | `hosting` or `care_plan` |

Rules reference items by `key`, so price edits flow through. A suggestion for an
archived or missing key is skipped and reported ("Blog setup is archived").
**Build proposal** creates a draft proposal pre-filled with the suggestions.

## 5. Proposals (CRM side)

Tables:

`proposals`: `id`, `deal_id` → deals, `version` int, `title`, `summary` ("What
you told us"), `timeline` text, `valid_until` date, `status`
(`draft` \| `sent` \| `viewed` \| `accepted` \| `declined` \| `expired` \|
`superseded`), `token_hash` text (sha-256 of the link code; null until sent),
`sent_at`, `viewed_at`, `decided_at`, `accepted_option`
(`full` \| `milestones` \| `own_it`), `accepted_name`, `decline_reason`,
`superseded_by` → proposals, `created_by`, timestamps.

`proposal_lines`: `id`, `proposal_id`, `position`, `item_key` (null for custom
lines), `name`, `description`, `quantity` numeric > 0, `unit`,
`unit_price_cents` (negative allowed only for a discount line), `recurring`,
`price_is_from`, `includes` text[], `excludes` text[], `internal_hours`,
`needs_discovery` boolean, `discount_reason` text.

Rules:

- Lines **snapshot** name, description, price, includes/excludes and hours
  when added. Editing the price book never changes an existing proposal.
- A discount is a line with a negative price and a stated reason (e.g.
  "Introductory rate: case-study permission").
- Totals: one-time = sum of non-recurring lines; monthly = sum of recurring.
- Only `draft` is editable. **Send** generates the link code, stores its hash,
  sets `sent_at` and `valid_until` (default +30 days), and locks the proposal.
  **Revise** is available on any proposal that is not a draft and not
  accepted (sent, viewed, declined, expired). It copies it into a new draft
  (`version + 1`) and marks the old one `superseded` with a pointer to the new
  one.
- Sending is refused when the proposal has no lines or any line has
  `needs_discovery`.

Builder screen (`/crm/proposals/$id`): edit title, summary, timeline; add
price-book items or custom lines; reorder, edit quantity/price, delete.
Private panel: estimated hours, **effective hourly rate**
(one-time total ÷ hours, shown only when every one-time line has hours),
warnings for total under $999 and for `needs_discovery` lines. Actions:
**Send**, **Copy link**, **Email it** (`mailto:` with the link),
**Download PDF**, **Revise**.

The deal page gets a **Proposals** card listing versions and statuses.

## 6. Client proposal page and acceptance

Route `/proposal/$code`, public, `noindex`, branded. Server functions take the
code, hash it, and call RPCs; no session. Sections:

1. Title and "What you told us"
2. What we'll build: one-time lines with their includes
3. Monthly, after launch: recurring lines
4. Not included: combined excludes
5. Timeline and valid-until date
6. Choose how to pay: eligible options with what is due when
7. What happens next: SOW to sign, first payment (or the own-it plan's first
   month), then kickoff

**Accept**: client selects a payment option, types their name, and ticks "I
accept this proposal. The work will be governed by the Statement of Work
GivenTake Devs sends next." **Decline**: optional reason.

On accept: `status = accepted`, record option, name and time; set
`deals.value_usd` to the one-time total; add a deal timeline event; create a
task "Send SOW to <client>" due the next day; notify the owner by email if the
existing new-lead notification mailer can be reused (confirm during planning;
otherwise the task is the notification).

On decline: `status = declined` with reason; timeline event. The reason is
shown when the deal is later marked lost.

Edge cases:

- First open sets `viewed_at` and `status = viewed`. The staff preview
  (`/crm/proposals/$id/preview`, session required) never does.
- Past `valid_until`: page shows "expired" with a contact button; the state is
  computed on read and stored as `expired` on the next write attempt.
- Superseded: page says an updated proposal was sent instead.
- Accept/decline are only legal from `sent` or `viewed`; the RPC enforces this,
  so double clicks and replays are no-ops that return the current state.
- Own-it option is only offered, and only accepted, when one-time total ≤
  $1,788.

PDF: a print stylesheet on the same page; **Download PDF** calls
`window.print()`. No PDF library.

## 7. SOW hand-off

`generateSowDraft` gains a mapping from the accepted proposal:

| SOW section | Source |
|---|---|
| 1. Background and objective | `summary` |
| 3. Deliverables | one-time lines with includes |
| 4. Out of scope | combined excludes |
| 6. Timeline and dependencies | `timeline` |
| 7. Fees and payment schedule | totals and the chosen option's schedule (`[AMOUNT]`, `[X]` rows) |

Sections 2, 5, 8–11 keep the template's standard wording. The mapping is built
and unit-tested now; **sending stays blocked** by the existing
attorney-review banner check (`hasUnresolvedReview`). Note for the lawyer: the
template needs wording for the own-it plan, which today only describes
milestone payments.

## 8. Architecture and security

- All writes go through `security definer` RPCs executable by `service_role`
  only, matching `deal_set_outcome` / `deal_link_lead`; tables have RLS forced
  and no direct grants. Price-book writes and sending are admin-only at the
  server-function layer.
- Public page: the code is 32 random bytes (base64url); only its sha-256 is
  stored. RPCs look up by hash and return only that proposal's client-facing
  fields (never `internal_hours` or `created_by`).
- Money in cents (`bigint`), as `invoices.amount_cents` already is.
- Pure functions in `src/lib/proposals.ts`: `scopingSuggestions(answers,
  items)`, `proposalTotals(lines)`, `paymentOptions(totals)`,
  `effectiveRate(lines)`, `sowFields(proposal)`.

## 9. Testing

- Unit: the five pure functions (rules, totals with discounts and recurring
  lines, own-it threshold at $1,788 / $1,789, effective rate with missing
  hours, SOW field mapping).
- Postgres integration (`crm-grants.integration.test.mjs` pattern): grants are
  service_role-only; status machine (accept/decline only from sent/viewed;
  own-it refused above threshold; sending refused with no lines or
  `needs_discovery`); lookup by hash.
- RPC shape tests for new `CrmActions` methods.
- E2E: build a proposal from scoping, send, open the link, accept; the deal
  value and the "Send SOW" task appear.

## 10. Out of scope

Sending email from inside the CRM; Stripe and deposit collection; the SOW's
legal review; qualifying fields (next design); delivery workspace; review and
referral automation.
