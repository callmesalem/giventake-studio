alter table public.attribution_touches
add column campaign_external_id text check (
  campaign_external_id is null
  or (
    char_length(campaign_external_id) between 1 and 200
    and campaign_external_id !~ '[[:cntrl:]]'
  )
);

alter table public.attribution_touches
add column is_manual boolean generated always as (touch_type = 'manual') stored;

alter table public.attribution_touches
add column original_computed_touch_id uuid;

alter table public.attribution_touches
add constraint attribution_touches_tenant_id_id_key unique (tenant_id, id);

alter table public.attribution_touches
add constraint attribution_touches_original_computed_fkey
foreign key (tenant_id, original_computed_touch_id)
references public.attribution_touches (tenant_id, id)
on delete cascade;

alter table public.attribution_touches
add constraint attribution_touches_original_computed_shape_check check (
  (touch_type = 'manual' and is_manual)
  or
  (touch_type <> 'manual' and not is_manual and original_computed_touch_id is null)
);

create index attribution_touches_original_computed_idx
on public.attribution_touches (tenant_id, original_computed_touch_id, created_at desc, id desc)
where original_computed_touch_id is not null;

drop policy if exists attribution_touches_owner_insert on public.attribution_touches;
drop policy if exists attribution_touches_owner_update on public.attribution_touches;
drop policy if exists attribution_touches_owner_delete on public.attribution_touches;
revoke insert, update, delete on public.attribution_touches from authenticated;

create or replace function public.is_sanitized_audit_metadata(input_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item record;
  scalar_value text;
  attribution_reason_pattern constant text :=
    '(declared_source:(google_ads|meta_ads|referral|organic|direct|other)'
    || '|click_id:(gclid|gbraid|wbraid|fbclid)'
    || '|utm_source:(google_ads|meta_ads|referral|organic|direct|other)'
    || '|utm_campaign|referrer_domain:(google|meta|other)|direct_or_unknown|manual_correction)';
begin
  if jsonb_typeof(input_value) <> 'object' then
    return false;
  end if;

  for item in select entry.key, entry.value from jsonb_each(input_value) entry
  loop
    if item.key not in (
      'channel', 'change_code', 'reason_code',
      'status', 'previous_status', 'current_status',
      'provider', 'error_code', 'attribution_model', 'confidence', 'request_type',
      'old_source', 'new_source', 'old_confidence', 'new_confidence',
      'old_state', 'new_state', 'old_reason_codes', 'new_reason_codes',
      'expires_at', 'occurred_at', 'completed_at', 'window_start', 'window_end', 'recorded_on',
      'connection_id', 'lead_id', 'campaign_id', 'sync_run_id', 'privacy_request_id', 'site_id',
      'amount_minor', 'rows_processed', 'imported_count', 'published_count',
      'sync_rows_deleted', 'evidence_rows_deleted', 'touch_rows_deleted', 'consent_rows_deleted',
      'revenue_rows_deleted', 'idempotency_rows_deleted', 'lead_rows_deleted',
      'metric_rows_deleted', 'audit_rows_deleted', 'privacy_rows_deleted', 'matched_count',
      'superseded_count', 'has_more'
    ) or jsonb_typeof(item.value) not in ('string', 'number', 'boolean', 'null')
      or char_length(item.value::text) > 500 then
      return false;
    end if;

    scalar_value := item.value #>> '{}';

    if item.key = 'channel' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('magic_link') then return false; end if;

    if item.key = 'change_code' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in (
        'invitation_accepted', 'settings_saved',
        'lead_status_changed', 'lead_reopened', 'revenue_recorded'
      ) then return false; end if;

    if item.key = 'reason_code' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('tenant_not_allowed') then return false; end if;

    if item.key in ('status', 'previous_status', 'current_status')
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in (
        'active', 'suspended', 'closed', 'new', 'qualified', 'booked', 'won', 'lost',
        'healthy', 'degraded', 'action_required', 'revoked', 'pending', 'running',
        'succeeded', 'partial', 'failed', 'verified', 'restricted', 'processing',
        'completed', 'enabled', 'paused', 'removed', 'unknown'
      ) then return false; end if;

    if item.key = 'provider' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('google_analytics', 'google_ads', 'meta_ads') then return false; end if;

    if item.key = 'error_code' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in (
        'RATE_LIMITED', 'NETWORK', 'TOKEN_EXPIRED', 'TOKEN_REVOKED',
        'INVALID_RESPONSE', 'INVALID_SCOPE'
      ) then return false; end if;

    if item.key = 'attribution_model' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('first_touch', 'last_touch') then return false; end if;

    if item.key in ('confidence', 'old_confidence', 'new_confidence')
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('high', 'medium', 'low') then return false; end if;

    if item.key in ('old_state', 'new_state')
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('attributed', 'ambiguous', 'unattributed') then return false; end if;

    if item.key in ('old_source', 'new_source')
      and jsonb_typeof(item.value) <> 'null'
      and (
        char_length(scalar_value) not between 1 and 80
        or scalar_value !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
      ) then return false; end if;

    if item.key in ('old_reason_codes', 'new_reason_codes')
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value !~ ('^' || attribution_reason_pattern || '(,' || attribution_reason_pattern || ')*$')
      then return false; end if;

    if item.key = 'request_type' and jsonb_typeof(item.value) <> 'null'
      and scalar_value not in ('access', 'correction', 'deletion', 'export', 'opt_out') then
      return false;
    end if;

    if item.key in (
      'connection_id', 'lead_id', 'campaign_id', 'sync_run_id', 'privacy_request_id', 'site_id'
    ) and jsonb_typeof(item.value) <> 'null'
      and scalar_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return false;
    end if;

    if item.key in ('expires_at', 'occurred_at', 'completed_at')
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}([.]\d+)?(Z|[+-]\d{2}(:\d{2})?)$' then
      return false;
    end if;

    if item.key in ('window_start', 'window_end', 'recorded_on')
      and jsonb_typeof(item.value) <> 'null'
      and scalar_value !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;

    if item.key in (
      'amount_minor', 'rows_processed', 'imported_count', 'published_count',
      'sync_rows_deleted', 'evidence_rows_deleted', 'touch_rows_deleted',
      'consent_rows_deleted', 'revenue_rows_deleted', 'idempotency_rows_deleted',
      'lead_rows_deleted', 'metric_rows_deleted', 'audit_rows_deleted',
      'privacy_rows_deleted', 'matched_count', 'superseded_count'
    ) and jsonb_typeof(item.value) <> 'null'
      and (jsonb_typeof(item.value) <> 'number' or scalar_value !~ '^[0-9]+$') then
      return false;
    end if;

    if item.key = 'has_more' and jsonb_typeof(item.value) not in ('boolean', 'null') then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create function public.is_attribution_decision(input_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  decision_confidence text;
  decision_reason jsonb;
  decision_source text;
  decision_state text;
begin
  if jsonb_typeof(input_value) <> 'object'
    or input_value - array[
      'source', 'campaign_external_id', 'confidence', 'state', 'reason_codes'
    ] <> '{}'::jsonb
    or not input_value ?& array[
      'source', 'campaign_external_id', 'confidence', 'state', 'reason_codes'
    ] then
    return false;
  end if;

  decision_source := input_value ->> 'source';
  decision_confidence := input_value ->> 'confidence';
  decision_state := input_value ->> 'state';

  if decision_confidence not in ('high', 'medium', 'low')
    or decision_state not in ('attributed', 'ambiguous', 'unattributed')
    or (
      decision_state = 'unattributed'
      and jsonb_typeof(input_value -> 'source') <> 'null'
    )
    or (
      decision_state <> 'unattributed'
      and (
        decision_source is null
        or char_length(decision_source) not between 1 and 80
        or decision_source !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
      )
    )
    or (
      jsonb_typeof(input_value -> 'campaign_external_id') not in ('string', 'null')
      or (
        jsonb_typeof(input_value -> 'campaign_external_id') = 'string'
        and (
          char_length(input_value ->> 'campaign_external_id') not between 1 and 200
          or (input_value ->> 'campaign_external_id') ~ '[[:cntrl:]]'
        )
      )
    )
    or jsonb_typeof(input_value -> 'reason_codes') <> 'array'
    or jsonb_array_length(input_value -> 'reason_codes') < 1 then
    return false;
  end if;

  for decision_reason in select value from jsonb_array_elements(input_value -> 'reason_codes')
  loop
    if jsonb_typeof(decision_reason) <> 'string'
      or (decision_reason #>> '{}') !~ (
        '^(declared_source:(google_ads|meta_ads|referral|organic|direct|other)'
        || '|click_id:(gclid|gbraid|wbraid|fbclid)'
        || '|utm_source:(google_ads|meta_ads|referral|organic|direct|other)'
        || '|utm_campaign|referrer_domain:(google|meta|other)|direct_or_unknown)$'
      ) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create function private.attribution_touch_json(touch public.attribution_touches)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', touch.id,
    'source', case when touch.state = 'unattributed' then null else touch.normalized_source end,
    'campaign_external_id', touch.campaign_external_id,
    'confidence', touch.confidence,
    'state', touch.state,
    'reason_codes', to_jsonb(touch.reason_codes)
  )
$$;

create function public.apply_attribution_recomputation(
  target_tenant uuid,
  target_lead uuid,
  first_evidence_id uuid,
  first_decision jsonb,
  last_evidence_id uuid,
  last_decision jsonb,
  event_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_any boolean := false;
  decision jsonb;
  evidence_id uuid;
  model record;
  new_campaign_external_id text;
  new_confidence public.attribution_confidence;
  new_reason_codes text[];
  new_source text;
  new_state text;
  old_touch public.attribution_touches%rowtype;
begin
  if event_request_id is null then
    raise exception using errcode = '22004', message = 'request id is required';
  end if;
  if not exists (
    select 1 from public.leads lead
    where lead.tenant_id = target_tenant
      and lead.id = target_lead
      and lead.restricted_at is null
  ) then
    return jsonb_build_object('found', false, 'changed', false);
  end if;
  if not public.is_attribution_decision(first_decision)
    or not public.is_attribution_decision(last_decision) then
    raise exception using errcode = '22023', message = 'attribution decision is invalid';
  end if;

  for model in
    select * from (
      values
        ('first'::public.attribution_touch_type, first_evidence_id, first_decision),
        ('last'::public.attribution_touch_type, last_evidence_id, last_decision)
    ) as selected(touch_type, selected_evidence_id, selected_decision)
  loop
    evidence_id := model.selected_evidence_id;
    decision := model.selected_decision;
    if evidence_id is not null and not exists (
      select 1 from public.attribution_evidence evidence
      where evidence.tenant_id = target_tenant
        and evidence.lead_id = target_lead
        and evidence.id = evidence_id
        and evidence.occurred_at <= (
          select lead.occurred_at from public.leads lead
          where lead.tenant_id = target_tenant and lead.id = target_lead
        )
    ) then
      raise exception using errcode = '22023', message = 'attribution evidence is invalid';
    end if;

    new_source := coalesce(decision ->> 'source', 'unattributed');
    new_campaign_external_id := decision ->> 'campaign_external_id';
    new_confidence := (decision ->> 'confidence')::public.attribution_confidence;
    new_state := decision ->> 'state';
    select coalesce(array_agg(value order by ordinal), '{}'::text[])
    into new_reason_codes
    from jsonb_array_elements_text(decision -> 'reason_codes') with ordinality reason(value, ordinal);

    old_touch := null;
    select touch.* into old_touch
    from public.attribution_touches touch
    where touch.tenant_id = target_tenant
      and touch.lead_id = target_lead
      and touch.touch_type = model.touch_type
      and not touch.is_manual
    order by touch.created_at desc, touch.id desc
    limit 1;

    if old_touch.id is null
      or old_touch.evidence_id is distinct from evidence_id
      or old_touch.normalized_source is distinct from new_source
      or old_touch.campaign_external_id is distinct from new_campaign_external_id
      or old_touch.confidence is distinct from new_confidence
      or old_touch.state is distinct from new_state
      or old_touch.reason_codes is distinct from new_reason_codes then
      insert into public.attribution_touches (
        tenant_id, lead_id, evidence_id, touch_type, normalized_source,
        campaign_external_id, confidence, state, reason_codes
      ) values (
        target_tenant, target_lead, evidence_id, model.touch_type, new_source,
        new_campaign_external_id, new_confidence, new_state, new_reason_codes
      );

      perform public.write_audit_event(
        target_tenant,
        'attribution.recomputed',
        'lead',
        target_lead,
        event_request_id,
        jsonb_build_object(
          'attribution_model', case
            when model.touch_type = 'first' then 'first_touch' else 'last_touch'
          end,
          'old_source', case
            when old_touch.id is null or old_touch.state = 'unattributed' then null
            else old_touch.normalized_source
          end,
          'new_source', case when new_state = 'unattributed' then null else new_source end,
          'old_confidence', case when old_touch.id is null then null else old_touch.confidence::text end,
          'new_confidence', new_confidence::text,
          'old_state', case when old_touch.id is null then null else old_touch.state end,
          'new_state', new_state,
          'old_reason_codes', case
            when old_touch.id is null then null else array_to_string(old_touch.reason_codes, ',')
          end,
          'new_reason_codes', array_to_string(new_reason_codes, ',')
        ),
        null
      );
      changed_any := true;
    end if;
  end loop;

  return jsonb_build_object('found', true, 'changed', changed_any);
end;
$$;

create function public.correct_attribution(
  target_tenant uuid,
  target_lead uuid,
  original_touch_id uuid,
  correction_source text,
  correction_campaign_external_id text,
  correction_confidence public.attribution_confidence,
  correction_reason text,
  event_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  correction_touch public.attribution_touches%rowtype;
  original_touch public.attribution_touches%rowtype;
begin
  if not public.is_client_owner(target_tenant) then
    raise exception using errcode = '42501', message = 'client owner required';
  end if;
  if event_request_id is null then
    raise exception using errcode = '22004', message = 'request id is required';
  end if;
  correction_source := btrim(correction_source);
  correction_campaign_external_id := nullif(btrim(correction_campaign_external_id), '');
  correction_reason := btrim(correction_reason);
  if correction_source is null
    or char_length(correction_source) not between 1 and 80
    or correction_source !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'correction source is invalid';
  end if;
  if correction_campaign_external_id is not null and (
    char_length(correction_campaign_external_id) not between 1 and 200
    or correction_campaign_external_id ~ '[[:cntrl:]]'
  ) then
    raise exception using errcode = '22023', message = 'correction campaign is invalid';
  end if;
  if correction_reason is null
    or char_length(correction_reason) not between 10 and 500
    or correction_reason ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'correction reason must be 10-500 characters';
  end if;

  select touch.* into original_touch
  from public.attribution_touches touch
  join public.leads lead
    on lead.tenant_id = touch.tenant_id and lead.id = touch.lead_id
  where touch.tenant_id = target_tenant
    and touch.lead_id = target_lead
    and touch.id = original_touch_id
    and touch.touch_type in ('first', 'last')
    and not touch.is_manual
    and lead.restricted_at is null;
  if not found then
    return null;
  end if;

  insert into public.attribution_touches (
    tenant_id, lead_id, evidence_id, touch_type, normalized_source,
    campaign_external_id, confidence, state, reason_codes,
    manual_actor, manual_reason, original_computed_touch_id
  ) values (
    target_tenant, target_lead, original_touch.evidence_id, 'manual', correction_source,
    correction_campaign_external_id, correction_confidence, 'attributed',
    array['manual_correction'], actor_user_id, correction_reason, original_touch.id
  )
  returning * into correction_touch;

  perform public.write_audit_event(
    target_tenant,
    'attribution.corrected',
    'lead',
    target_lead,
    event_request_id,
    jsonb_build_object(
      'attribution_model', case
        when original_touch.touch_type = 'first' then 'first_touch' else 'last_touch'
      end,
      'old_source', case
        when original_touch.state = 'unattributed' then null else original_touch.normalized_source
      end,
      'new_source', correction_source,
      'old_confidence', original_touch.confidence::text,
      'new_confidence', correction_confidence::text,
      'old_state', original_touch.state,
      'new_state', 'attributed',
      'old_reason_codes', array_to_string(original_touch.reason_codes, ','),
      'new_reason_codes', 'manual_correction'
    ),
    actor_user_id
  );

  return jsonb_build_object(
    'original', private.attribution_touch_json(original_touch),
    'correction', private.attribution_touch_json(correction_touch)
      || jsonb_build_object('reason', correction_touch.manual_reason)
  );
end;
$$;

create function public.get_lead_attribution(target_tenant uuid, target_lead uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  computed_touch public.attribution_touches%rowtype;
  correction_touch public.attribution_touches%rowtype;
  model public.attribution_touch_type;
  result jsonb := '{}'::jsonb;
begin
  if not public.can_access_tenant(target_tenant)
    or not exists (
      select 1 from public.leads lead
      where lead.tenant_id = target_tenant
        and lead.id = target_lead
        and lead.restricted_at is null
    ) then
    return null;
  end if;

  foreach model in array array[
    'first'::public.attribution_touch_type,
    'last'::public.attribution_touch_type
  ]
  loop
    computed_touch := null;
    correction_touch := null;
    select touch.* into computed_touch
    from public.attribution_touches touch
    where touch.tenant_id = target_tenant
      and touch.lead_id = target_lead
      and touch.touch_type = model
      and not touch.is_manual
    order by touch.created_at desc, touch.id desc
    limit 1;

    if computed_touch.id is not null then
      select touch.* into correction_touch
      from public.attribution_touches touch
      where touch.tenant_id = target_tenant
        and touch.lead_id = target_lead
        and touch.is_manual
        and touch.original_computed_touch_id = computed_touch.id
      order by touch.created_at desc, touch.id desc
      limit 1;
    end if;

    result := result || jsonb_build_object(
      case when model = 'first' then 'first_touch' else 'last_touch' end,
      case when computed_touch.id is null then null else jsonb_build_object(
        'original', private.attribution_touch_json(computed_touch),
        'correction', case
          when correction_touch.id is null then null
          else private.attribution_touch_json(correction_touch)
            || jsonb_build_object('reason', correction_touch.manual_reason)
        end,
        'selected', private.attribution_touch_json(coalesce(correction_touch, computed_touch))
      ) end
    );
  end loop;

  return result;
end;
$$;

create function public.get_growth_overview(
  target_tenant uuid,
  range_start date,
  range_end date,
  attribution_model text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  tenant_currency text;
  tenant_timezone text;
begin
  if range_start is null or range_end is null
    or range_end < range_start
    or range_end - range_start > 365 then
    raise exception using errcode = '22023', message = 'invalid overview date range';
  end if;
  if attribution_model not in ('first_touch', 'last_touch') then
    raise exception using errcode = '22023', message = 'invalid attribution model';
  end if;
  if not public.can_access_tenant(target_tenant) then
    return null;
  end if;

  select tenant.currency, tenant.timezone
  into tenant_currency, tenant_timezone
  from public.tenants tenant
  where tenant.id = target_tenant and tenant.status = 'active';
  if not found then
    return null;
  end if;

  with effective_attribution as (
    select
      lead.id as lead_id,
      lead.status,
      lead.occurred_at,
      coalesce(correction.normalized_source, computed.normalized_source) as source,
      coalesce(correction.state, computed.state) as state
    from public.leads lead
    left join lateral (
      select touch.*
      from public.attribution_touches touch
      where touch.tenant_id = lead.tenant_id
        and touch.lead_id = lead.id
        and touch.touch_type = case
          when attribution_model = 'first_touch' then 'first'::public.attribution_touch_type
          else 'last'::public.attribution_touch_type
        end
        and not touch.is_manual
      order by touch.created_at desc, touch.id desc
      limit 1
    ) computed on true
    left join lateral (
      select touch.*
      from public.attribution_touches touch
      where touch.tenant_id = lead.tenant_id
        and touch.lead_id = lead.id
        and touch.is_manual
        and touch.original_computed_touch_id = computed.id
      order by touch.created_at desc, touch.id desc
      limit 1
    ) correction on true
    where lead.tenant_id = target_tenant and lead.restricted_at is null
  ),
  range_leads as (
    select * from effective_attribution attribution
    where (attribution.occurred_at at time zone tenant_timezone)::date
      between range_start and range_end
  ),
  lead_facts as (
    select
      count(*)::integer as total_leads,
      count(*) filter (where status in ('qualified', 'booked', 'won'))::integer
        as qualified_leads,
      count(*) filter (where status = 'won')::integer as won_leads,
      count(*) filter (
        where status in ('qualified', 'booked', 'won')
          and source in ('google_ads', 'meta_ads')
          and state <> 'unattributed'
      )::integer as paid_qualified_leads,
      count(*) filter (
        where source is null or state is null or state = 'unattributed'
      )::integer as unattributed_leads,
      count(*) filter (where state = 'ambiguous')::integer as ambiguous_leads
    from range_leads
  ),
  revenue_facts as (
    select
      coalesce(sum(outcome.amount_minor), 0)::text as confirmed_revenue_minor,
      coalesce(sum(outcome.amount_minor) filter (
        where attribution.source in ('google_ads', 'meta_ads')
          and attribution.state <> 'unattributed'
      ), 0)::text as paid_revenue_minor,
      coalesce(sum(outcome.amount_minor) filter (
        where attribution.source is not null and attribution.state <> 'unattributed'
      ), 0)::text as attributed_revenue_minor
    from public.revenue_outcomes outcome
    join effective_attribution attribution on attribution.lead_id = outcome.lead_id
    where outcome.tenant_id = target_tenant
      and outcome.superseded_at is null
      and outcome.currency = tenant_currency
      and outcome.confirmed_on between range_start and range_end
      and attribution.status = 'won'
  ),
  metric_facts as (
    select sum(metric.spend_minor)::text as spend_minor
    from public.campaign_metrics_daily metric
    where metric.tenant_id = target_tenant
      and metric.metric_date between range_start and range_end
      and metric.currency = tenant_currency
      and metric.is_complete
  ),
  freshness as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'provider', provider.provider,
        'last_successful_sync', latest.last_success_at,
        'state', case
          when latest.id is null or latest.last_success_at is null then 'missing'
          when latest.health = 'healthy' then 'fresh'
          else 'stale'
        end
      ) order by provider.ordinal
    ), '[]'::jsonb) as value
    from unnest(enum_range(null::public.provider)) with ordinality provider(provider, ordinal)
    left join lateral (
      select connection.id, connection.health, connection.last_success_at
      from public.connections connection
      where connection.tenant_id = target_tenant
        and connection.provider = provider.provider
      order by connection.last_success_at desc nulls last, connection.id desc
      limit 1
    ) latest on true
  )
  select jsonb_build_object(
    'range', jsonb_build_object(
      'start', range_start, 'end', range_end, 'timezone', tenant_timezone
    ),
    'currency', tenant_currency,
    'freshness', freshness.value,
    'facts', jsonb_build_object(
      'total_leads', lead_facts.total_leads,
      'qualified_leads', lead_facts.qualified_leads,
      'won_leads', lead_facts.won_leads,
      'paid_qualified_leads', lead_facts.paid_qualified_leads,
      'confirmed_revenue_minor', revenue_facts.confirmed_revenue_minor,
      'spend_minor', metric_facts.spend_minor,
      'paid_revenue_minor', revenue_facts.paid_revenue_minor,
      'attributed_revenue_minor', revenue_facts.attributed_revenue_minor,
      'unattributed_leads', lead_facts.unattributed_leads,
      'ambiguous_leads', lead_facts.ambiguous_leads
    )
  ) into result
  from lead_facts, revenue_facts, metric_facts, freshness;

  return result;
end;
$$;

revoke all on function public.is_attribution_decision(jsonb) from public, anon, authenticated;
grant execute on function public.is_attribution_decision(jsonb) to service_role;

revoke all on function private.attribution_touch_json(public.attribution_touches)
from public, anon, authenticated, service_role;

revoke all on function public.apply_attribution_recomputation(
  uuid, uuid, uuid, jsonb, uuid, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.apply_attribution_recomputation(
  uuid, uuid, uuid, jsonb, uuid, jsonb, uuid
) to service_role;

revoke all on function public.correct_attribution(
  uuid, uuid, uuid, text, text, public.attribution_confidence, text, uuid
) from public, anon, service_role;
grant execute on function public.correct_attribution(
  uuid, uuid, uuid, text, text, public.attribution_confidence, text, uuid
) to authenticated;

revoke all on function public.get_lead_attribution(uuid, uuid)
from public, anon, service_role;
grant execute on function public.get_lead_attribution(uuid, uuid) to authenticated;

revoke all on function public.get_growth_overview(uuid, date, date, text)
from public, anon, service_role;
grant execute on function public.get_growth_overview(uuid, date, date, text) to authenticated;
