-- Phase 1 — CRM foundation. Six confusing nav items collapse into three real
-- objects (Companies, Contacts, Deals); "Leads / Prospects / Clients" become
-- lifecycle stages of Contacts, not separate tables.
--
-- Additive and reversible. Every column added is nullable or defaulted, the
-- `leads` table is NOT dropped (it stays the source of truth until Salem
-- confirms the fold in the UI), and `clients` is untouched (it is operator
-- foundation, FK-referenced by projects/touchpoints, not a CRM table). Nothing
-- that reads these tables today can break.
--
-- Rollback: steps 1-2 are pure column additions; step 3 only inserts contacts
-- tagged source='lead_migration' (delete those rows to undo); step 4 only sets
-- a nullable deals.contact_id. `leads` and `clients` are left intact.

begin;

-- 1. CONTACTS becomes the unified person record a salesperson can actually work.
--    lifecycle_stage answers "where is this person" — the thing that turned the
--    Leads/Prospects/Clients tabs into duplicate lists. owner/assigned/next_action
--    answer "whose is it and what's the next step" — the difference between a
--    database and a book of business.
alter table public.contacts add column if not exists lifecycle_stage text not null default 'lead'
  check (lifecycle_stage in ('lead','qualified','customer','lost'));
alter table public.contacts add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.contacts add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.contacts add column if not exists next_action text;
alter table public.contacts add column if not exists next_action_due timestamptz;
-- lead carry-over fields, so folding a lead loses nothing:
alter table public.contacts add column if not exists budget text;
alter table public.contacts add column if not exists timeline text;
alter table public.contacts add column if not exists lead_status text;      -- old leads.status, kept for reference
alter table public.contacts add column if not exists consent_given boolean;
alter table public.contacts add column if not exists consent_at timestamptz;
alter table public.contacts add column if not exists consent_text text;

create index if not exists contacts_lifecycle_stage_idx on public.contacts (lifecycle_stage);
create index if not exists contacts_assigned_to_idx on public.contacts (assigned_to);

-- 2. DEALS gain a human. Today a deal links only to a company, so "who is the
--    contact on this deal" is unanswerable. Nullable, ON DELETE SET NULL so
--    removing a person never deletes the pipeline.
alter table public.deals add column if not exists contact_id uuid references public.contacts on delete set null;

-- 3. FOLD leads INTO contacts. Idempotent: each folded row is tagged
--    source='lead_migration', source_record_id=<lead id>, and the table's
--    unique(source, source_record_id) makes re-running a no-op. A lead whose
--    email already exists as a contact is skipped (email match, case-insensitive)
--    so we never create a duplicate person.
--
--    leads.company is free text; we link to an existing company by exact name if
--    one is found, else leave company_id null (Phase 1.1 can enrich).
insert into public.contacts (
  company_id, name, email, source, source_record_id,
  lifecycle_stage, owner_id, assigned_to, budget, timeline, lead_status,
  consent_given, consent_at, consent_text, metadata, synthetic, created_at
)
select
  (select c.id from public.companies c
     where lower(c.name) = lower(l.company) order by c.created_at limit 1),
  l.name,
  l.email,
  'lead_migration',
  l.id::text,
  case
    when l.qualified_at is not null then 'qualified'
    when l.status = 'lost' then 'lost'
    else 'lead'
  end,
  l.owner_id,
  l.assigned_to,
  l.budget,
  l.timeline,
  l.status,
  l.consent_given,
  l.consent_at,
  l.consent_text,
  jsonb_build_object('migrated_from_lead_id', l.id, 'lead_source', l.source, 'lead_source_detail', l.source_detail),
  l.synthetic,
  l.created_at
from public.leads l
where not exists (
  select 1 from public.contacts x
  where x.source = 'lead_migration' and x.source_record_id = l.id::text
)
and not exists (
  select 1 from public.contacts x
  where l.email is not null and lower(x.email) = lower(l.email)
);

-- 4. LINK the existing deals to a contact where derivable, via the shared
--    company. Picks the earliest contact at that company as the primary. Only
--    fills nulls; never overwrites a link.
update public.deals d
set contact_id = (
  select c.id from public.contacts c
  where c.company_id = d.company_id
  order by c.created_at limit 1
)
where d.contact_id is null and d.company_id is not null;

commit;
