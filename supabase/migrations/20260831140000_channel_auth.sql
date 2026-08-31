-- Make the Sami channel token observable, and slow to guess.
--
-- giventake-mcp is gated by one shared secret, SAMI_CHANNEL_TOKEN. That gate is
-- not changed here and is still the whole boundary; the surface is read-only and
-- the worst a stolen token does is disclose the pipeline. What was missing is
-- everything that makes that risk MANAGEABLE:
--
--   1. Nothing recorded that the token had ever been used, so a leak was
--      undetectable, unattributable, and indistinguishable from Sami polling.
--   2. Nothing limited how fast the token could be guessed.
--
-- WHAT THIS DOES NOT FIX, said plainly so nobody reads it as solved: the token
-- is still one static string with no identity and no expiry, and the client IP
-- it is attributed to arrives in a header the client can set. Per-device tokens
-- with independent revocation is the real answer. This makes the current design
-- observable and survivable in the meantime.
--
-- Purely additive: one new table, two new read/write RPCs, no DROP and no
-- destructive ALTER. Same posture as the rest of this schema: RLS on and forced,
-- no anon/authenticated grants, access only through SECURITY DEFINER functions
-- granted to service_role.

create table if not exists public.channel_auth_log (
  id uuid primary key default gen_random_uuid(),
  surface text not null,
  outcome text not null check (outcome in ('granted','denied')),
  presented_via text not null check (presented_via in ('header','query','none')),
  client_ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  -- Computed by the RPC rather than a generated column: date_trunc over
  -- timestamptz is STABLE, not IMMUTABLE, so Postgres rejects it in a
  -- generated column or an index expression.
  hour_bucket timestamptz not null
);

-- Successes collapse to one row per surface/ip/hour. A polling agent produces
-- thousands of authorised calls a day and none of them are interesting; the
-- denials are. Partial, so denials are never collapsed and stay countable.
create unique index if not exists channel_auth_log_granted_hourly_idx
  on public.channel_auth_log (surface, client_ip, hour_bucket)
  where outcome = 'granted';

create index if not exists channel_auth_log_denied_idx
  on public.channel_auth_log (surface, client_ip, created_at)
  where outcome = 'denied';

alter table public.channel_auth_log enable row level security;
alter table public.channel_auth_log force row level security;
revoke all on table public.channel_auth_log from anon, authenticated;

comment on table public.channel_auth_log is
  'Every token presentation at a channel surface. Successes collapse hourly via a partial unique index; denials are kept individually so they can be counted. Written only by channel_auth_record.';

-- Record one token presentation.
--
-- on conflict do nothing is what turns the hourly partial unique index into a
-- collapse instead of an error: the twentieth authorised poll of the hour is a
-- silent no-op rather than a failure the caller has to handle.
--
-- user_agent is truncated here as well as at the caller because the column is
-- unbounded text fed from a header a stranger controls.
create or replace function public.channel_auth_record(
  p_surface text,
  p_outcome text,
  p_presented_via text,
  p_client_ip text,
  p_user_agent text
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.channel_auth_log
    (surface, outcome, presented_via, client_ip, user_agent, hour_bucket)
  values
    (p_surface, p_outcome, p_presented_via, p_client_ip,
     left(p_user_agent, 300), date_trunc('hour', now()))
  on conflict do nothing;
$$;

comment on function public.channel_auth_record(text,text,text,text,text) is
  'Append one channel auth outcome. Authorised rows collapse to one per surface/ip/hour; denials always insert.';

-- Is this caller guessing?
--
-- Denials only. A wrong token is either a misconfigured device retrying or
-- somebody trying values, and neither should run at full speed. Authorised calls
-- are never throttled: Sami polls, and a burst of legitimate reads must never be
-- told to wait.
--
-- Returns false when p_client_ip is null. We cannot rate limit what we cannot
-- identify, and blocking every unidentifiable caller would lock out anyone
-- behind a proxy that strips the header.
--
-- The subquery stops at p_max rows. Under exactly the flood this function exists
-- to notice, counting every matching row is the expensive part, and the answer
-- never needs a number larger than the threshold.
create or replace function public.channel_auth_too_many_failures(
  p_surface text,
  p_client_ip text,
  p_max int default 10,
  p_window_seconds int default 300
) returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case
    when p_client_ip is null then false
    else (
      select count(*) >= greatest(coalesce(p_max, 10), 1)
      from (
        select 1
        from public.channel_auth_log
        where outcome = 'denied'
          and surface = p_surface
          and client_ip = p_client_ip
          and created_at > now() - make_interval(secs => greatest(coalesce(p_window_seconds, 300), 0))
        limit greatest(coalesce(p_max, 10), 1)
      ) capped
    )
  end;
$$;

comment on function public.channel_auth_too_many_failures(text,text,int,int) is
  'True when denials for this surface and client ip within the window reach p_max. False for a null ip: an unidentifiable caller cannot be rate limited, and refusing them all would lock out anyone behind a header-stripping proxy.';

revoke all on function
  public.channel_auth_record(text,text,text,text,text),
  public.channel_auth_too_many_failures(text,text,int,int) from public;
grant execute on function
  public.channel_auth_record(text,text,text,text,text),
  public.channel_auth_too_many_failures(text,text,int,int) to service_role;
