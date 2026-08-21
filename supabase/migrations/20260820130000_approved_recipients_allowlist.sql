-- Approved-recipient allowlist (charter §3.8: "Contact anyone not on an
-- approved recipient list for that SOP" is a hard prohibition). Today only a
-- blocklist exists (do_not_contact + operator_is_suppressed) — a blocklist is
-- not an allowlist, and §3.8 requires a positive, per-SOP approval record.
--
-- Purely additive: no DROP, no destructive ALTER. Same security model as the
-- rest of this schema: RLS on, no anon/authenticated grants, no direct table
-- access for runtime roles, access only via a narrow SECURITY DEFINER RPC.

create table public.approved_recipients (
  id uuid primary key default gen_random_uuid(),
  -- Exactly one of normalized_address / domain identifies what this entry
  -- approves: a single address, or an entire domain for that SOP.
  normalized_address text,
  domain text,
  sop text not null check (sop ~ '^[a-z0-9_-]+$'),
  approved_by text not null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (normalized_address is not null or domain is not null),
  check (expires_at is null or expires_at > approved_at)
);

-- One approval per (sop, address) and per (sop, domain) — coalesce so a
-- NULL address/domain doesn't defeat uniqueness the way it would in a plain
-- UNIQUE constraint (NULL <> NULL).
create unique index approved_recipients_sop_address_idx
  on public.approved_recipients (sop, coalesce(normalized_address, ''), coalesce(domain, ''));

create index approved_recipients_address_idx on public.approved_recipients (normalized_address);
create index approved_recipients_domain_idx on public.approved_recipients (domain);

alter table public.approved_recipients enable row level security;
alter table public.approved_recipients force row level security;
revoke all on table public.approved_recipients from anon, authenticated;

comment on table public.approved_recipients is
  'Charter §3.8 approved-recipient allowlist, per SOP. A blocklist (do_not_contact) is not a substitute: this is the positive list an operator must be on before it may be contacted for a given SOP. Rows are added by a human only — see is_approved_recipient() comment for why no agent-callable insert RPC exists.';

-- Read-only check: is this address approved for this SOP right now?
-- Suppression always wins over approval — a do_not_contact entry blocks
-- contact even if the same address also has a live approved_recipients row.
create function public.is_approved_recipient(p_address text, p_sop text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_address text;
  v_domain text;
begin
  if p_address is null or trim(p_address) = '' or p_sop is null or trim(p_sop) = '' then
    return false;
  end if;

  v_address := lower(trim(p_address));
  v_domain := lower(split_part(v_address, '@', 2));

  -- Suppression always wins over approval.
  if exists (select 1 from public.do_not_contact where normalized_address = v_address) then
    return false;
  end if;

  return exists (
    select 1
      from public.approved_recipients ar
     where ar.sop = p_sop
       and (ar.expires_at is null or ar.expires_at > now())
       and (
         ar.normalized_address = v_address
         or (ar.domain is not null and v_domain <> '' and ar.domain = v_domain)
       )
  );
end;
$$;

comment on function public.is_approved_recipient(text, text) is
  'Charter §3.8 allowlist check. Returns false when the address is absent, expired, or suppressed via do_not_contact (suppression always wins). '
  'Deliberately no matching agent-callable insert/mutate RPC: an agent that could add its own approved recipients would have no allowlist at all, '
  'just an allowlist-shaped rubber stamp. Only a human adds rows to approved_recipients (direct table write, service_role/dashboard/migration), '
  'the same way only a human decides an approval_queue entry via approval_decide.';

revoke all on function public.is_approved_recipient(text, text) from public;
grant execute on function public.is_approved_recipient(text, text) to service_role, crm_agent;
