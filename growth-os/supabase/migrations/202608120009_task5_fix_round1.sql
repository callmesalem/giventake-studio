alter function public.ingest_website_lead(
  uuid, uuid, uuid, text, uuid, timestamptz, jsonb, jsonb, jsonb, uuid
) rename to ingest_website_lead_unvalidated;

create function public.ingest_website_lead(
  target_tenant uuid,
  target_site uuid,
  request_idempotency_key uuid,
  request_body_digest text,
  external_event uuid,
  event_occurred_at timestamptz,
  encrypted_lead jsonb,
  attribution jsonb,
  consent jsonb,
  event_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  consent_recorded_at timestamptz;
begin
  if jsonb_typeof(consent) is distinct from 'object'
    or consent -> 'necessary' is distinct from 'true'::jsonb
    or consent -> 'contact_requested' is distinct from 'true'::jsonb
    or jsonb_typeof(consent -> 'analytics') is distinct from 'boolean'
    or jsonb_typeof(consent -> 'marketing') is distinct from 'boolean'
    or jsonb_typeof(consent -> 'preferences') is distinct from 'boolean'
    or jsonb_typeof(consent -> 'gpc') is distinct from 'boolean'
    or jsonb_typeof(consent -> 'policy_version') is distinct from 'string'
    or nullif(btrim(consent ->> 'policy_version'), '') is null
    or octet_length(consent ->> 'policy_version') > 80
    or consent -> 'source' is distinct from '"contact-form"'::jsonb
    or jsonb_typeof(consent -> 'recorded_at') is distinct from 'string' then
    raise exception using errcode = '22023', message = 'consent receipt is invalid';
  end if;

  begin
    consent_recorded_at := (consent ->> 'recorded_at')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'consent receipt is invalid';
  end;

  if consent_recorded_at is null then
    raise exception using errcode = '22023', message = 'consent receipt is invalid';
  end if;

  return public.ingest_website_lead_unvalidated(
    target_tenant,
    target_site,
    request_idempotency_key,
    request_body_digest,
    external_event,
    event_occurred_at,
    encrypted_lead,
    attribution,
    consent,
    event_request_id
  );
end;
$$;

revoke all on function public.ingest_website_lead_unvalidated(
  uuid, uuid, uuid, text, uuid, timestamptz, jsonb, jsonb, jsonb, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.ingest_website_lead(
  uuid, uuid, uuid, text, uuid, timestamptz, jsonb, jsonb, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.ingest_website_lead(
  uuid, uuid, uuid, text, uuid, timestamptz, jsonb, jsonb, jsonb, uuid
) to service_role;
