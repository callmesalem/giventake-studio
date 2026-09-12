-- Giveaway entries: capture for the "win a free website" lead-generation giveaway.
--
-- Entries collect personal/business contact info plus THREE separate consents
-- (rules agreement, email marketing, SMS). The consents, and when they were
-- given, are the legally load-bearing part: CAN-SPAM, TCPA, and CCPA all turn on
-- being able to show what a person agreed to and when. So each consent is its own
-- column, plus the verbatim consent-text version they saw and a timestamp.
--
-- Marketing consent is stored separately from the required rules agreement and is
-- never a condition of entry: a valid entry can have email_marketing_consent and
-- sms_consent both false.
--
-- Same access posture as documents/e-signature and demo_sites: RLS on with NO
-- policies, every path a SECURITY DEFINER function. The app (service_role) inserts
-- entries; an admin read is granted to crm_agent so entries can be reviewed and
-- worked as leads without exposing the table.

create table if not exists public.giveaway_entries (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  city text,
  about text,

  -- Required to enter. A row with agreed_rules = false should never be written;
  -- the RPC rejects it.
  agreed_rules boolean not null default false,

  -- Optional, unbundled marketing consents. Default false. Never required.
  email_marketing_consent boolean not null default false,
  sms_consent boolean not null default false,

  -- Evidence: the exact consent wording version shown, and when consent was given.
  consent_text_version text,
  consent_at timestamptz not null default now(),

  source text not null default 'giveaway',
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- One entry per business email. Re-submission updates consents rather than duplicating.
create unique index if not exists giveaway_entries_email_uidx
  on public.giveaway_entries (lower(email));
create index if not exists giveaway_entries_created_idx on public.giveaway_entries (created_at desc);

alter table public.giveaway_entries enable row level security;
revoke all on table public.giveaway_entries from anon, authenticated;

-- Create/refresh an entry. App-facing (service_role), called from the server-side
-- endpoint that receives the form POST. Rejects an entry that did not agree to the
-- rules. On duplicate email, updates the mutable fields + consents (someone
-- re-entering can change their mind on marketing) and keeps the original created_at.
create or replace function public.giveaway_entry_create(
  p_business_name text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_city text,
  p_about text,
  p_agreed_rules boolean,
  p_email_marketing_consent boolean,
  p_sms_consent boolean,
  p_consent_text_version text,
  p_ip text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(p_agreed_rules, false) is not true then
    raise exception 'giveaway_entry_create: entry requires agreement to the official rules';
  end if;
  if coalesce(btrim(p_business_name), '') = '' or coalesce(btrim(p_email), '') = '' then
    raise exception 'giveaway_entry_create: business_name and email are required';
  end if;

  insert into giveaway_entries (
    business_name, contact_name, email, phone, city, about,
    agreed_rules, email_marketing_consent, sms_consent,
    consent_text_version, ip, user_agent
  ) values (
    btrim(p_business_name), btrim(p_contact_name), lower(btrim(p_email)), p_phone, p_city, p_about,
    true, coalesce(p_email_marketing_consent, false), coalesce(p_sms_consent, false),
    p_consent_text_version, p_ip, p_user_agent
  )
  on conflict (lower(email)) do update set
    business_name = excluded.business_name,
    contact_name = excluded.contact_name,
    phone = excluded.phone,
    city = excluded.city,
    about = excluded.about,
    email_marketing_consent = excluded.email_marketing_consent,
    sms_consent = excluded.sms_consent,
    consent_text_version = excluded.consent_text_version,
    consent_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.giveaway_entry_create(text, text, text, text, text, text, boolean, boolean, boolean, text, text, text) from public;
grant execute on function public.giveaway_entry_create(text, text, text, text, text, text, boolean, boolean, boolean, text, text, text) to service_role;

-- Admin read, for reviewing entries and working them as leads. Granted to crm_agent
-- (the execute-only MCP role) and service_role. Not the browser.
create or replace function public.giveaway_entries_list()
returns setof public.giveaway_entries
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select * from giveaway_entries order by created_at desc;
$$;

revoke all on function public.giveaway_entries_list() from public;
grant execute on function public.giveaway_entries_list() to service_role, crm_agent;
