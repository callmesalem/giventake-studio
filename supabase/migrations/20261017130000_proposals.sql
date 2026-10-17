-- supabase/migrations/20261017130000_proposals.sql
-- Proposals: priced offers built from the price book, sent as a private link,
-- accepted or declined by the client. Not the contract: accepting never moves
-- deals.stage (stage 4 still requires a signed SOW). Lines are snapshots, so
-- price book edits never change a proposal already sent.

alter table public.deals add column if not exists scoping jsonb not null default '{}'
  check (jsonb_typeof(scoping) = 'object');

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  version integer not null default 1,
  title text not null check (length(btrim(title)) between 1 and 200),
  summary text not null default '' check (length(summary) <= 4000),
  timeline text not null default '' check (length(timeline) <= 200),
  status text not null default 'draft'
    check (status in ('draft','sent','viewed','accepted','declined','expired','superseded')),
  token_hash text unique,
  valid_until date,
  sent_at timestamptz,
  viewed_at timestamptz,
  decided_at timestamptz,
  accepted_option text check (accepted_option in ('full','milestones','own_it')),
  accepted_name text,
  decline_reason text,
  superseded_by uuid references public.proposals(id),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, version)
);

create table if not exists public.proposal_lines (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  position integer not null,
  item_key text,
  name text not null check (length(btrim(name)) between 1 and 200),
  description text not null default '',
  quantity numeric not null check (quantity > 0),
  unit text not null check (unit in ('each','page','town','month')),
  unit_price_cents bigint not null,
  recurring boolean not null default false,
  price_is_from boolean not null default false,
  includes text[] not null default '{}',
  excludes text[] not null default '{}',
  internal_hours numeric,
  needs_discovery boolean not null default false,
  discount_reason text,
  check (unit_price_cents >= 0 or (discount_reason is not null and btrim(discount_reason) <> ''))
);

create index if not exists proposal_lines_proposal_idx on public.proposal_lines (proposal_id, position);
create index if not exists proposals_deal_idx on public.proposals (deal_id, version desc);

alter table public.proposals enable row level security;
alter table public.proposals force row level security;
alter table public.proposal_lines enable row level security;
alter table public.proposal_lines force row level security;
revoke all on table public.proposals, public.proposal_lines from public, anon, authenticated, service_role;
grant select on table public.proposals, public.proposal_lines to service_role;

-- One-time total in cents, clamped at zero (matches proposalTotals in src/lib/proposals.ts).
create or replace function public.proposal_one_time_cents(p_id uuid)
returns bigint language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(0, coalesce(sum(round(unit_price_cents * quantity)), 0))::bigint
  from proposal_lines where proposal_id = p_id and not recurring;
$$;
revoke all on function public.proposal_one_time_cents(uuid) from public, anon, authenticated;

create or replace function public.deal_set_scoping(p_deal_id uuid, p_scoping jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_scoping is null or jsonb_typeof(p_scoping) <> 'object' then
    raise exception 'scoping must be a JSON object';
  end if;
  update deals set scoping = p_scoping, updated_at = now() where id = p_deal_id;
  if not found then raise exception 'deal not found: %', p_deal_id; end if;
end $$;

create or replace function public.proposal_save_draft(
  p_id uuid, p_deal_id uuid, p_title text, p_summary text, p_timeline text, p_lines jsonb, p_actor text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_status text;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'lines must be a JSON array';
  end if;
  if p_id is null then
    perform 1 from deals where id = p_deal_id for update;
    if not found then raise exception 'deal not found: %', p_deal_id; end if;
    insert into proposals (deal_id, version, title, summary, timeline, created_by)
    values (p_deal_id,
            coalesce((select max(version) from proposals where deal_id = p_deal_id), 0) + 1,
            btrim(p_title), coalesce(p_summary, ''), coalesce(p_timeline, ''), p_actor)
    returning id into v_id;
  else
    select status into v_status from proposals where id = p_id and deal_id = p_deal_id for update;
    if not found then raise exception 'proposal not found: %', p_id; end if;
    if v_status <> 'draft' then raise exception 'only a draft proposal can be edited'; end if;
    update proposals set title = btrim(p_title), summary = coalesce(p_summary, ''),
      timeline = coalesce(p_timeline, ''), updated_at = now()
    where id = p_id returning id into v_id;
    delete from proposal_lines where proposal_id = v_id;
  end if;

  insert into proposal_lines (proposal_id, position, item_key, name, description, quantity, unit,
    unit_price_cents, recurring, price_is_from, includes, excludes, internal_hours,
    needs_discovery, discount_reason)
  select v_id, l.ord::int, nullif(l.v->>'item_key', ''), l.v->>'name', coalesce(l.v->>'description', ''),
    (l.v->>'quantity')::numeric, l.v->>'unit', (l.v->>'unit_price_cents')::bigint,
    coalesce((l.v->>'recurring')::boolean, false), coalesce((l.v->>'price_is_from')::boolean, false),
    coalesce(array(select jsonb_array_elements_text(coalesce(l.v->'includes', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(l.v->'excludes', '[]'::jsonb))), '{}'),
    nullif(l.v->>'internal_hours', '')::numeric,
    coalesce((l.v->>'needs_discovery')::boolean, false), nullif(l.v->>'discount_reason', '')
  from jsonb_array_elements(p_lines) with ordinality as l(v, ord);

  return v_id;
end $$;

create or replace function public.proposal_send(p_id uuid, p_token_hash text, p_valid_days integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text;
begin
  select status into v_status from proposals where id = p_id for update;
  if not found then raise exception 'proposal not found: %', p_id; end if;
  if v_status <> 'draft' then raise exception 'only a draft proposal can be sent'; end if;
  if not exists (select 1 from proposal_lines where proposal_id = p_id) then
    raise exception 'a proposal with no lines cannot be sent';
  end if;
  if exists (select 1 from proposal_lines where proposal_id = p_id and needs_discovery) then
    raise exception 'price every quote-after-discovery line before sending';
  end if;
  if (select coalesce(sum(round(unit_price_cents * quantity)), 0) from proposal_lines
      where proposal_id = p_id and not recurring) <= 0 then
    raise exception 'the one-time total must be above zero';
  end if;
  if p_token_hash is null or length(p_token_hash) < 8 then raise exception 'token hash is required'; end if;
  update proposals set status = 'sent', token_hash = p_token_hash, sent_at = now(),
    valid_until = current_date + greatest(1, coalesce(p_valid_days, 30)), updated_at = now()
  where id = p_id;
end $$;

create or replace function public.proposal_revise(p_id uuid, p_actor text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old proposals; v_new uuid;
begin
  select * into v_old from proposals where id = p_id for update;
  if not found then raise exception 'proposal not found: %', p_id; end if;
  if v_old.status in ('draft', 'accepted', 'superseded') then
    raise exception 'only a sent, viewed, declined or expired proposal can be revised';
  end if;
  insert into proposals (deal_id, version, title, summary, timeline, created_by)
  values (v_old.deal_id, (select max(version) from proposals where deal_id = v_old.deal_id) + 1,
          v_old.title, v_old.summary, v_old.timeline, p_actor)
  returning id into v_new;
  insert into proposal_lines (proposal_id, position, item_key, name, description, quantity, unit,
    unit_price_cents, recurring, price_is_from, includes, excludes, internal_hours,
    needs_discovery, discount_reason)
  select v_new, position, item_key, name, description, quantity, unit, unit_price_cents, recurring,
    price_is_from, includes, excludes, internal_hours, needs_discovery, discount_reason
  from proposal_lines where proposal_id = p_id;
  update proposals set status = 'superseded', superseded_by = v_new, updated_at = now() where id = p_id;
  return v_new;
end $$;

-- Client-facing view. Never returns internal_hours, created_by or token_hash.
create or replace function public.proposal_public(p_token_hash text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'summary', p.summary,
    'timeline', p.timeline,
    'valid_until', p.valid_until,
    'state', case
      when p.status = 'accepted' then 'accepted'
      when p.status = 'declined' then 'declined'
      when p.status = 'superseded' then 'superseded'
      when p.status = 'expired' or p.valid_until < current_date then 'expired'
      else 'open' end,
    'accepted_option', p.accepted_option,
    'client', (select c.name from deals d left join companies c on c.id = d.company_id where d.id = p.deal_id),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', l.name, 'description', l.description, 'quantity', l.quantity, 'unit', l.unit,
        'unit_price_cents', l.unit_price_cents, 'recurring', l.recurring,
        'price_is_from', l.price_is_from, 'includes', l.includes, 'excludes', l.excludes,
        'discount_reason', l.discount_reason) order by l.position)
      from proposal_lines l where l.proposal_id = p.id), '[]'::jsonb)
  )
  from proposals p
  where p.token_hash = p_token_hash and p.status <> 'draft';
$$;

-- Advisory and one-way, like document_mark_viewed: mail scanners may trigger it.
create or replace function public.proposal_mark_viewed(p_token_hash text)
returns void language sql security definer set search_path = public, pg_temp as $$
  update proposals set status = 'viewed', viewed_at = now(), updated_at = now()
  where token_hash = p_token_hash and status = 'sent' and valid_until >= current_date;
$$;

create or replace function public.proposal_decide(
  p_token_hash text, p_decision text, p_option text, p_name text, p_reason text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v proposals; v_total bigint; v_deal deals;
begin
  select * into v from proposals where token_hash = p_token_hash for update;
  if not found then raise exception 'proposal not found'; end if;

  if v.status in ('sent', 'viewed') and v.valid_until < current_date then
    update proposals set status = 'expired', updated_at = now() where id = v.id;
    return jsonb_build_object('status', 'expired');
  end if;
  -- Replays, double clicks and late clicks return the current state unchanged.
  if v.status not in ('sent', 'viewed') then
    return jsonb_build_object('status', v.status);
  end if;

  if p_decision = 'decline' then
    update proposals set status = 'declined', decided_at = now(),
      decline_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), ''), updated_at = now()
    where id = v.id;
    return jsonb_build_object('status', 'declined');
  end if;

  if p_decision is distinct from 'accept' then raise exception 'decision must be accept or decline'; end if;
  if p_option is null or p_option not in ('full', 'milestones', 'own_it') then
    raise exception 'payment option is not valid';
  end if;
  if p_name is null or length(btrim(p_name)) < 2 or length(p_name) > 200 then
    raise exception 'type your full name to accept';
  end if;
  v_total := proposal_one_time_cents(v.id);
  if p_option = 'own_it' and v_total > 178800 then
    raise exception 'the own-it plan is only available for one-time totals of $1,788 or less';
  end if;

  update proposals set status = 'accepted', decided_at = now(), accepted_option = p_option,
    accepted_name = btrim(p_name), updated_at = now()
  where id = v.id;

  select * into v_deal from deals where id = v.deal_id for update;
  update deals set value_usd = v_total / 100.0, updated_at = now() where id = v.deal_id;

  insert into tasks (source, source_record_id, company_id, content, deadline_at, metadata)
  values ('proposal', v.id::text, v_deal.company_id,
          'Send SOW to ' || coalesce(v_deal.name, 'client') || ' (proposal accepted)',
          now() + interval '1 day', jsonb_build_object('deal_id', v.deal_id))
  on conflict (source, source_record_id) do nothing;

  return jsonb_build_object('status', 'accepted');
end $$;

revoke all on function public.deal_set_scoping(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.proposal_save_draft(uuid, uuid, text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.proposal_send(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.proposal_revise(uuid, text) from public, anon, authenticated;
revoke all on function public.proposal_public(text) from public, anon, authenticated;
revoke all on function public.proposal_mark_viewed(text) from public, anon, authenticated;
revoke all on function public.proposal_decide(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.deal_set_scoping(uuid, jsonb) to service_role;
grant execute on function public.proposal_save_draft(uuid, uuid, text, text, text, jsonb, text) to service_role;
grant execute on function public.proposal_send(uuid, text, integer) to service_role;
grant execute on function public.proposal_revise(uuid, text) to service_role;
grant execute on function public.proposal_public(text) to service_role;
grant execute on function public.proposal_mark_viewed(text) to service_role;
grant execute on function public.proposal_decide(text, text, text, text, text) to service_role;
