-- Careers / job applications capture (store + notify; no sending, no operator run).
--
-- Additive, and it follows the same safety envelope as capture_website_lead:
--   * RLS on; direct table access revoked for anon/authenticated/service_role.
--   * Data is reached ONLY through the narrow SECURITY DEFINER RPC below.
--   * Nothing here sends. The email notification is handled by the server
--     function (src/lib/intake.ts submitApplication) via Resend, not the DB.
--   * Grants/revokes are scoped to the new objects only.

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  role text,
  links text,        -- LinkedIn / portfolio URL(s)
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists job_applications_created_idx
  on public.job_applications(created_at desc);

alter table public.job_applications enable row level security;
revoke all on table public.job_applications from anon, authenticated, service_role;
comment on table public.job_applications is
  'Website careers-form applications. Written via the capture_job_application SECURITY DEFINER RPC only; no direct role grants.';

-- Narrow capture RPC. Validates a bounded payload and inserts one application.
create function public.capture_job_application(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_allowed text[] := array['name','email','phone','role','links','message'];
  v_email text;
  v_name text;
  v_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'object payload required';
  end if;
  if exists (select 1 from jsonb_object_keys(p_payload) k where not (k = any(v_allowed))) then
    raise exception 'unexpected payload key';
  end if;

  v_email := lower(trim(p_payload->>'email'));
  v_name := trim(p_payload->>'name');

  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 255 then
    raise exception 'valid email required';
  end if;
  if v_name is null or length(v_name) < 1 or length(v_name) > 100 then
    raise exception 'valid name required';
  end if;
  if length(coalesce(p_payload->>'phone','')) > 40
     or length(coalesce(p_payload->>'role','')) > 120
     or length(coalesce(p_payload->>'links','')) > 500
     or length(coalesce(p_payload->>'message','')) > 4000 then
    raise exception 'field too long';
  end if;

  insert into job_applications(name, email, phone, role, links, message)
  values (
    v_name,
    v_email,
    nullif(trim(coalesce(p_payload->>'phone','')), ''),
    nullif(trim(coalesce(p_payload->>'role','')), ''),
    nullif(trim(coalesce(p_payload->>'links','')), ''),
    nullif(trim(coalesce(p_payload->>'message','')), '')
  )
  returning id into v_id;

  return jsonb_build_object('applicationId', v_id);
end $$;

revoke all on function public.capture_job_application(jsonb) from public;
grant execute on function public.capture_job_application(jsonb) to service_role;
comment on function public.capture_job_application(jsonb) is
  'Records a website job application. Validates a bounded payload; never sends. service_role execute only.';
