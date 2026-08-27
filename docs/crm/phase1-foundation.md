# CRM Phase 1 — Foundation (grounded spec)

Status: approved in principle by Salem (2026-08-27). This doc is the build contract.
Nothing here mutates the live DB until the migration is run on the branch, verified by
row counts, and shown to Salem before merge/deploy.

## Why this differs from the verbal design

The verbal design was based on a live row-count snapshot (13 companies / 3 contacts /
2 leads / 6 deals / 0 clients). Reading the actual DDL (`supabase/migrations/`) surfaced
two corrections that make the plan safer:

1. **`clients` is NOT a free-standing "won deal" join.** It is part of the operator-control
   foundation (`20260814133600_operator_control_foundation.sql`) and is FK-referenced by
   `public.projects.client_id` and `public.touchpoints.client_id`. It has 0 rows, but
   **dropping the table would touch operator internals.** Decision: **remove `clients` from
   the CRM nav, keep the table** for operator/project use. "Customer" becomes a contact
   lifecycle stage, not a dropped table.

2. **`deals` link to `company_id` only** — there is no `lead_id`/`contact_id` on deals today.
   To make a deal answer "who is the human on this", Phase 1 adds a nullable
   `deals.contact_id` (FK `contacts`, `on delete set null`).

Also noted: `leads` already carries `owner_id`, `assigned_to`, `status`, `qualified_at`,
`consent_*`, `budget`, `timeline`, `source`, `attribution`. `contacts` carries none of these.
So the "make it workable by a hire" fields land on **contacts** (the unified person), and the
lead data folds in.

## Real schema today (from migrations)

- **companies**: id, name, domain, description, categories(jsonb), employee_range, location,
  socials, source, source_record_id, metadata, synthetic, timestamps. `unique(source, source_record_id)`.
- **contacts**: id, company_id→companies(set null), name, email, phone, job_title, socials,
  source, source_record_id, metadata, synthetic, timestamps. No stage/owner/next_action.
- **deals**: id, company_id→companies(set null), name, stage(text), value_usd, source,
  source_record_id, metadata, synthetic, timestamps.
- **leads**: id, email, name, synthetic, created_at + company(text), description, budget,
  timeline, source, source_detail, attribution(jsonb), status(default 'new'), captured_at,
  qualified_at, qualification(jsonb), last_touch_at, owner_id, assigned_to, consent_given,
  consent_at, consent_text. Referenced by touchpoints.lead_id and lead notes.
- **clients** (operator foundation, 0 rows): id, name, ai_processing_allowed, synthetic,
  created_at. Referenced by projects.client_id, touchpoints.client_id.

## Target model: 6 nav items → 3 objects + stage views

| Object | Role |
|---|---|
| **Companies** | organizations (13 Piper-sourced orgs live here) |
| **Contacts** | the unified person, each with a lifecycle **stage** |
| **Deals** | the pipeline (now optionally tied to a contact) |

- **Leads / Prospects / Clients** become **saved filtered views of Contacts by stage**, not
  separate nav sections or duplicate tables.
- Lifecycle stage: `lead → qualified → customer → lost`.

## Migration plan (additive, reversible until the final step)

New migration file: `supabase/migrations/2026XXXX_crm_foundation_phase1.sql`

1. `alter table contacts add column`:
   - `lifecycle_stage text not null default 'lead'` (check in lead/qualified/customer/lost)
   - `owner_id uuid references auth.users(id) on delete set null`
   - `assigned_to uuid references auth.users(id) on delete set null`
   - `next_action text`, `next_action_due timestamptz`
   - lead-carryover: `budget text`, `timeline text`, `consent_given boolean`,
     `consent_at timestamptz`, `consent_text text`, `status text` (kept for parity)
2. `alter table deals add column contact_id uuid references contacts on delete set null`.
3. **Backfill**: for each `leads` row, upsert a `contacts` row
   (match on lower(email); else insert), copying name/email/company(text→match or create
   company)/budget/timeline/source/owner/assigned_to/consent/status→lifecycle_stage.
   Record provenance in `contacts.metadata.migrated_from_lead_id`.
4. Link the 6 deals to a contact where derivable (via company_id → primary contact).
5. Switch nav to Contacts-by-stage views; drop `clients` and any dead route from the nav
   (route file removed, table retained).
6. RLS: mirror the existing contacts RLS onto the new columns (no policy widening).

**Rollback**: steps 1-4 are pure additions. `leads` is left intact (not dropped in Phase 1)
so the source of truth is preserved until Salem confirms the fold is correct in the UI.
A later Phase 1.1 drops `leads` only after sign-off.

## Verification gate (before merge/deploy)

- Row counts before/after: companies=13, contacts ≥ 3 (grows by folded leads), deals=6,
  every lead accounted for in contacts.
- Click every `crm.*` route against the live DB; fix errors/blank renders.
- `npm run lint`, tests, `npm run build` green.
- Show Salem the branch preview before any merge or `wrangler deploy`.

## Open inputs from Salem

- **ICP** (industries / geo / size) — drives Piper enrichment + API targeting.
- **Which pages** he saw break (to prioritize the route audit).
- API keys for Apollo + Google Places, or approval to stand up free tiers.
