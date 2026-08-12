create or replace function public.enforce_lead_status_transaction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  transaction_owner name;
begin
  select pg_get_userbyid(routine.proowner)
  into transaction_owner
  from pg_catalog.pg_proc routine
  where routine.oid = 'public.change_lead_status(uuid,uuid,public.lead_status,uuid)'::regprocedure;

  if (
    old.status is distinct from new.status
    or old.preterminal_status is distinct from new.preterminal_status
  )
    and auth.uid() is not null
    and current_user <> transaction_owner then
    raise exception using errcode = '42501', message = 'lead status changes require transaction function';
  end if;
  return new;
end;
$$;

create function public.sanitize_lead_operation_metadata(
  event_action public.audit_action,
  event_metadata jsonb
)
returns jsonb
language sql
immutable
strict
set search_path = ''
as $$
  select case event_action
    when 'lead.status_changed' then
      jsonb_build_object(
        'change_code', 'lead_status_changed',
        'previous_status', case
          when event_metadata ->> 'previous_status' in ('new', 'qualified', 'booked')
            then event_metadata -> 'previous_status'
          else to_jsonb('new'::text)
        end,
        'current_status', case
          when event_metadata ->> 'current_status' in ('qualified', 'booked', 'won', 'lost')
            then event_metadata -> 'current_status'
          else to_jsonb('qualified'::text)
        end
      )
    when 'lead.reopened' then
      jsonb_build_object(
        'change_code', 'lead_reopened',
        'previous_status', case
          when event_metadata ->> 'previous_status' in ('won', 'lost')
            then event_metadata -> 'previous_status'
          else to_jsonb('lost'::text)
        end,
        'current_status', case
          when event_metadata ->> 'current_status' in ('new', 'qualified', 'booked')
            then event_metadata -> 'current_status'
          else to_jsonb('qualified'::text)
        end,
        'superseded_count', case
          when jsonb_typeof(event_metadata -> 'superseded_count') = 'number'
            and event_metadata ->> 'superseded_count' ~ '^[0-9]+$'
            then event_metadata -> 'superseded_count'
          else to_jsonb(0)
        end
      )
    when 'revenue.recorded' then
      jsonb_build_object(
        'change_code', 'revenue_recorded',
        'recorded_on', case
          when event_metadata ->> 'recorded_on' ~ '^\d{4}-\d{2}-\d{2}$'
            then event_metadata -> 'recorded_on'
          else to_jsonb('1970-01-01'::text)
        end,
        'superseded_count', case
          when jsonb_typeof(event_metadata -> 'superseded_count') = 'number'
            and event_metadata ->> 'superseded_count' ~ '^[0-9]+$'
            then event_metadata -> 'superseded_count'
          else to_jsonb(0)
        end
      )
    else event_metadata
  end
$$;

update public.audit_events event
set metadata = public.sanitize_lead_operation_metadata(event.action, event.metadata)
where event.action in ('lead.status_changed', 'lead.reopened', 'revenue.recorded')
  and event.metadata is distinct from public.sanitize_lead_operation_metadata(event.action, event.metadata);

alter table public.audit_events
validate constraint audit_events_lead_operation_metadata_check;

revoke all on function public.sanitize_lead_operation_metadata(public.audit_action, jsonb)
from public, anon, authenticated, service_role;
