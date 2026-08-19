-- Referral suite. Track referral partners (individuals, firms, partners) and the
-- referrals they send in. Draft + track only; any outreach stays human/gated.
-- Same security model as the other suites: RLS on, no anon/authenticated grants,
-- access only via narrow security-definer RPCs granted to service_role.

create table public.referral_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'individual' check (kind in ('individual','firm','partner')),
  contact_email text,
  notes text,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.referral_partners on delete set null,
  lead_id uuid references public.leads on delete set null,
  company_name text,
  status text not null default 'received'
    check (status in ('received','qualified','converted','declined')),
  reward_note text,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.referral_partners enable row level security;
alter table public.referrals enable row level security;

revoke all on table public.referral_partners, public.referrals from anon, authenticated;

-- Narrow RPCs. Service role only; no browser role grants; no direct table access.

create function public.referral_partner_upsert(
  p_id uuid, p_name text, p_kind text, p_contact_email text, p_notes text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if coalesce(p_kind,'individual') not in ('individual','firm','partner') then
    raise exception 'invalid kind';
  end if;
  if p_id is null then
    insert into referral_partners(name,kind,contact_email,notes)
      values(p_name,coalesce(p_kind,'individual'),p_contact_email,p_notes)
      returning id into v_id;
  else
    update referral_partners set name=p_name, kind=coalesce(p_kind,kind),
      contact_email=p_contact_email, notes=p_notes, updated_at=now()
      where id=p_id returning id into v_id;
    if v_id is null then raise exception 'referral partner not found'; end if;
  end if;
  return v_id;
end $$;

create function public.referral_record(p_partner_id uuid, p_lead_id uuid, p_company_name text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  insert into referrals(partner_id, lead_id, company_name)
    values(p_partner_id, p_lead_id, p_company_name)
    returning id into v_id;
  return v_id;
end $$;

create function public.referral_set_status(p_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_count bigint;
begin
  if p_status not in ('received','qualified','converted','declined') then
    raise exception 'invalid status';
  end if;
  update referrals set status=p_status, updated_at=now() where id=p_id;
  get diagnostics v_count = row_count;
  return v_count > 0;
end $$;

create function public.referral_snapshot()
returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
  select jsonb_build_object(
    'partners', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from referral_partners p), '[]'::jsonb),
    'referralsByStatus', coalesce(
      (select jsonb_object_agg(status, n) from (select status, count(*) n from referrals group by status) s),
      '{}'::jsonb)
  ) $$;

revoke all on function
  public.referral_partner_upsert(uuid,text,text,text,text),
  public.referral_record(uuid,uuid,text),
  public.referral_set_status(uuid,text),
  public.referral_snapshot() from public;
grant execute on function
  public.referral_partner_upsert(uuid,text,text,text,text),
  public.referral_record(uuid,uuid,text),
  public.referral_set_status(uuid,text),
  public.referral_snapshot() to service_role;
