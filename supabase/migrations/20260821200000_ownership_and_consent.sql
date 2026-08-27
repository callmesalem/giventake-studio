-- Phase 00 — record ownership, and consent evidence.
--
-- Additive only: every column is nullable with no default backfill, every index
-- is new, and no existing column, constraint or policy is altered. Nothing that
-- reads these tables today can break.
--
-- Two unrelated problems, one migration, because both are structural and both
-- get more expensive the longer the UI is built without them.
--
-- 1. OWNERSHIP. Salem asked for a CRM scoped to each user's login. Auth already
--    exists (roles admin/member from app_metadata, a team page, admin guards),
--    but no core table could say who a record belongs to. Without this, "my
--    leads" is unimplementable and every list, filter and query would be written
--    single-seat and revisited later.
--
--    owner_id    — who the record belongs to. Survives assignment changes.
--    assigned_to — who is actioning it right now. Only where work is done:
--                  leads, deals, tasks.
--
--    ON DELETE SET NULL, not CASCADE: removing a team member must never delete
--    the pipeline they touched.
--
-- 2. CONSENT EVIDENCE. The contact form requires a consent checkbox and
--    src/lib/intake.ts validates it, but nothing persists it. Every lead in the
--    table was captured with an agreement we hold no record of. If a recipient
--    later disputes that they consented, the answer today is "the form wouldn't
--    have submitted without it" — an inference about code, not evidence about a
--    person.
--
--    consent_text stores the wording shown AT THE TIME. Policy copy changes;
--    proving what someone agreed to means keeping the words they saw, not a
--    pointer to today's version of the page.

begin;

-- ── 1. Ownership ────────────────────────────────────────────────────────────

alter table public.leads      add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.deals      add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.companies  add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.contacts   add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.tasks      add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.notes      add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.clients    add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.projects   add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.invoices   add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.referrals  add column if not exists owner_id uuid references auth.users(id) on delete set null;

-- Assignment only where a human actually works the record.
alter table public.leads add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.deals add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.tasks add column if not exists assigned_to uuid references auth.users(id) on delete set null;

comment on column public.leads.owner_id is
  'Team member this record belongs to. Null means unassigned, which is the correct state for an agent-sourced record nobody has picked up yet.';
comment on column public.leads.assigned_to is
  'Team member actioning this record now. Distinct from owner_id so reassigning work does not rewrite who the relationship belongs to.';

-- Every "mine" view filters on these, so they are indexed from the start
-- rather than after the first slow page.
create index if not exists leads_owner_idx        on public.leads (owner_id);
create index if not exists leads_assigned_idx     on public.leads (assigned_to);
create index if not exists deals_owner_idx        on public.deals (owner_id);
create index if not exists deals_assigned_idx     on public.deals (assigned_to);
create index if not exists companies_owner_idx    on public.companies (owner_id);
create index if not exists contacts_owner_idx     on public.contacts (owner_id);
create index if not exists tasks_owner_idx        on public.tasks (owner_id);
create index if not exists tasks_assigned_idx     on public.tasks (assigned_to);
create index if not exists notes_owner_idx        on public.notes (owner_id);
create index if not exists clients_owner_idx      on public.clients (owner_id);
create index if not exists projects_owner_idx     on public.projects (owner_id);
create index if not exists invoices_owner_idx     on public.invoices (owner_id);
create index if not exists referrals_owner_idx    on public.referrals (owner_id);

-- ── 2. Consent evidence ─────────────────────────────────────────────────────

alter table public.leads add column if not exists consent_given boolean;
alter table public.leads add column if not exists consent_at    timestamptz;
alter table public.leads add column if not exists consent_text  text;

comment on column public.leads.consent_given is
  'Whether the submitter ticked the consent box. NULL means captured before this column existed and is deliberately not backfilled to true - inventing consent evidence is worse than admitting we have none.';
comment on column public.leads.consent_at is
  'When consent was given. Distinct from captured_at because the two can diverge for imported or re-confirmed records.';
comment on column public.leads.consent_text is
  'The exact wording shown to the submitter at the time. Policy copy changes; proving what someone agreed to requires the words they actually saw, not a pointer to the current page.';

-- Answering "did this person consent, and to what" is a lookup by address.
create index if not exists leads_email_consent_idx on public.leads (email) where consent_given is not null;

commit;
