-- Reputation suite. Reviews/testimonials and review requests. Publishing a review
-- is compliance-gated: a review may only reach 'published' once explicit
-- permission has been obtained from the author. Same security model as the other
-- suites: RLS on, no anon/authenticated grants, access only via security-definer
-- RPCs granted to service_role.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  source text,
  author_name text,
  subject text,
  rating int check (rating between 1 and 5),
  quote text,
  status text not null default 'draft'
    check (status in ('draft','approved','published','archived')),
  permission_obtained boolean not null default false,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_requests (
  id uuid primary key default gen_random_uuid(),
  subject_type text,
  subject_ref text,
  status text not null default 'requested'
    check (status in ('requested','received','declined')),
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;
alter table public.review_requests enable row level security;

revoke all on table public.reviews, public.review_requests from anon, authenticated;

-- Narrow RPCs. Service role only; no browser role grants; no direct table access.

create function public.review_upsert(
  p_id uuid, p_source text, p_author_name text, p_subject text, p_rating int,
  p_quote text, p_permission_obtained boolean
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then
    raise exception 'invalid rating';
  end if;
  if p_id is null then
    insert into reviews(source,author_name,subject,rating,quote,permission_obtained)
      values(p_source,p_author_name,p_subject,p_rating,p_quote,coalesce(p_permission_obtained,false))
      returning id into v_id;
  else
    update reviews set source=p_source, author_name=p_author_name, subject=p_subject,
      rating=p_rating, quote=p_quote,
      permission_obtained=coalesce(p_permission_obtained,permission_obtained),
      updated_at=now()
      where id=p_id returning id into v_id;
    if v_id is null then raise exception 'review not found'; end if;
  end if;
  return v_id;
end $$;

-- Set review status. CRITICAL compliance rule: a review may NEVER be published
-- unless permission_obtained is true. This is enforced here at the DB layer so no
-- runtime path (agent or otherwise) can publish without permission.
create function public.review_set_status(p_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_permission boolean; v_count bigint;
begin
  if p_status not in ('draft','approved','published','archived') then
    raise exception 'invalid status';
  end if;
  select permission_obtained into v_permission from reviews where id=p_id;
  if v_permission is null then raise exception 'review not found'; end if;
  if p_status='published' and v_permission is not true then
    raise exception 'cannot publish review without permission';
  end if;
  update reviews set status=p_status, updated_at=now() where id=p_id;
  get diagnostics v_count = row_count;
  return v_count > 0;
end $$;

create function public.review_request_record(p_subject_type text, p_subject_ref text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  insert into review_requests(subject_type, subject_ref)
    values(p_subject_type, p_subject_ref)
    returning id into v_id;
  return v_id;
end $$;

create function public.reputation_snapshot()
returns jsonb language sql security definer set search_path=public,pg_temp stable as $$
  select jsonb_build_object(
    'reviewsByStatus', coalesce(
      (select jsonb_object_agg(status, n) from (select status, count(*) n from reviews group by status) s),
      '{}'::jsonb),
    'requestsByStatus', coalesce(
      (select jsonb_object_agg(status, n) from (select status, count(*) n from review_requests group by status) s),
      '{}'::jsonb)
  ) $$;

revoke all on function
  public.review_upsert(uuid,text,text,text,int,text,boolean),
  public.review_set_status(uuid,text),
  public.review_request_record(text,text),
  public.reputation_snapshot() from public;
grant execute on function
  public.review_upsert(uuid,text,text,text,int,text,boolean),
  public.review_set_status(uuid,text),
  public.review_request_record(text,text),
  public.reputation_snapshot() to service_role;
