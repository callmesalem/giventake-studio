# 01 — Tooling stack

Chosen against three constraints: **an agent must be able to drive it** (so an API is
non-negotiable), it must fit a small budget, and it must not create a compliance
obligation you forget about.

**Running total: roughly $25–55/month** depending on options taken.

---

## The stack

| Function | Tool | Cost | API | Notes |
|---|---|---|---|---|
| Email + calendar | Google Workspace | $7–14/user/mo | Gmail, Calendar APIs | Needed anyway for `hello@`, `privacy@`, `legal@` |
| Transactional email | **Resend** | Free to 3k/mo | Yes | **Already coded** — `src/lib/intake.ts` |
| Client + pipeline records | **Supabase** (Postgres) | Free tier | Yes, plus MCP | See below |
| Invoicing + payments | **Stripe Invoicing** | No monthly; ~2.9% + 30¢ | Excellent | Hosted checkout keeps card data out of your systems entirely |
| E-signature | Dropbox Sign | ~$15/mo | Yes | Free alternative: Documenso (self-hosted) |
| Scheduling | **Cal.com** | Free tier | Yes | Self-hostable |
| Bookkeeping | Wave → QuickBooks | Free → ~$30/mo | Limited → Yes | Switch when sales tax gets real |
| Work tracking | **GitHub Issues** | Free | Excellent | Already in use; agents drive it well |
| Docs + SOPs | **This repo** | Free | Git | Version-controlled, reviewable, diffable |

### Why a database instead of a CRM

For an agent-operated business, a Postgres database you own beats a SaaS CRM:

- Agents query and write directly — no scraping a UI, no per-seat cost
- You own the data outright; no export problem later
- Schema fits your process instead of someone's idea of a sales funnel
- Free at your volume, and Supabase is already available to this session

A CRM is worth revisiting if you ever hire humans who need a UI. Until then it's a
subscription that makes agents' lives harder.

### Why Stripe for payments

Beyond the API: **hosted checkout means card details never touch your systems.**
That keeps PCI scope minimal, which is the correct posture for a studio this size and
matches the guidance already in `../business/09-client-process.md`.

---

## Suggested data model

Minimum tables to make the SOPs in this folder executable. Expand as needed; don't
start bigger than this.

```
clients          id, legal_name, primary_contact, email, entity_type,
                 ai_restrictions (MSA §3.4), created_at
leads            id, source, captured_at, status, qualified_at, notes
projects         id, client_id, sow_ref, status, start_date, target_date,
                 baseline_json  ← the kickoff numbers; see 03-onboarding
invoices         id, project_id, stripe_id, amount, issued, due, paid_at, status
support_tickets  id, project_id, severity, kind (defect|change), opened, closed
touchpoints      id, client_id, type, direction, sent_at, agent, body, sop_ref
agent_log        id, operator, sop, step, client_id, trigger, payload,
                 outcome, escalated, created_at   ← charter §9
```

Two fields carry real weight:

- **`clients.ai_restrictions`** — checked before *any* operator runs against that
  client (charter §7). Not optional.
- **`projects.baseline_json`** — the kickoff measurement. This is what makes an honest
  case study possible later, and it is the reason there isn't one on the site today.

---

## ⚠️ Every tool here is a compliance decision

**Anything that stores client personal data is a subprocessor.** Before switching one
on in production:

1. Add a row to [`../contracts/subprocessor-list.md`](../contracts/subprocessor-list.md)
2. Confirm the privacy policy §5 wording covers it — `src/routes/privacy.tsx`
3. Sign the vendor's DPA
4. If it's an AI tool, also register it per charter §7

Current status of the ones that matter:

- **Resend** — coded, dormant until `RESEND_API_KEY` is set. Already flagged in the
  subprocessor list as needing a DPA before going live.
- **Supabase, Stripe, Google Workspace, Cal.com, e-signature** — all will hold client
  personal data. None is disclosed yet. Handle before first client.

---

## Sequencing

**Before client #1:** Google Workspace, Resend, Supabase, Stripe, e-signature.
That's the minimum to sign someone and get paid.

**Before client #3:** Cal.com, bookkeeping, GitHub Issues for client work.

**Later:** QuickBooks when Ohio sales-tax separation gets complicated
(`../business/02-ohio-tax.md` §1), a CRM only if humans join.

**Not yet:** anything with a per-seat price, anything marketed as an "all-in-one
agency platform," and any paid analytics. You have no data to analyse yet.
