-- Website leads were invisible in the CRM.
--
-- Phase 1 (20260827120000_crm_foundation_phase1.sql) made `contacts` the CRM's
-- list of people and folded the leads that existed then into it, tagged
-- source='lead_migration', source_record_id=<lead id>. capture_website_lead was
-- never updated, so every lead captured since landed only in `leads`, which no
-- CRM list reads any more (/crm/leads redirects to Contacts).
--
-- Fix: capture mirrors the lead into contacts with the same key the fold used.
-- That key is what the contact detail page uses to pull the lead's touchpoints
-- into the timeline, so no app change is needed. `leads` stays the intake
-- record the operators and campaigns read. As in the fold, a person already in
-- contacts under another key is left alone rather than duplicated.
--
-- Rollback: re-apply the previous capture_website_lead body
-- (20260821220000_capture_origin.sql) and delete contacts with
-- source='lead_migration' created after this migration.

begin;

create or replace function public.capture_website_lead(p_payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_allowed text[] := array['email','name','company','description','budget','timeline','source','source_detail','attribution','consent','origin'];
  v_attr_allowed text[] := array['utm_source','utm_medium','utm_campaign','utm_content','utm_term','referrer'];
  v_consent_allowed text[] := array['given','text'];
  v_email text;
  v_name text;
  v_company text;
  v_description text;
  v_attr jsonb;
  v_origin text;
  v_consent_given boolean;
  v_consent_text text;
  v_lead uuid;
  v_touchpoint uuid;
  v_duplicate boolean := false;
  v_suppressed boolean;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'object payload required';
  end if;
  if exists (select 1 from jsonb_object_keys(p_payload) k where not (k = any(v_allowed))) then
    raise exception 'unexpected payload key';
  end if;

  v_email := lower(trim(p_payload->>'email'));
  v_name := trim(p_payload->>'name');
  v_company := nullif(trim(coalesce(p_payload->>'company','')), '');
  v_description := trim(coalesce(p_payload->>'description',''));

  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 255 then
    raise exception 'valid email required';
  end if;
  if v_name is null or length(v_name) < 1 or length(v_name) > 100 then
    raise exception 'valid name required';
  end if;
  if length(v_description) > 1500 then raise exception 'description too long'; end if;
  if v_company is not null and length(v_company) > 120 then raise exception 'company too long'; end if;
  if length(coalesce(p_payload->>'budget','')) > 80
     or length(coalesce(p_payload->>'timeline','')) > 80
     or length(coalesce(p_payload->>'source','')) > 80
     or length(coalesce(p_payload->>'source_detail','')) > 160 then
    raise exception 'field too long';
  end if;

  -- Origin: a closed vocabulary, because a free-text provenance field stops
  -- meaning anything the first time someone invents a value.
  v_origin := coalesce(nullif(trim(p_payload->>'origin'), ''), 'website_contact_form');
  if v_origin not in ('website_contact_form','manual_entry','referral_intake') then
    raise exception 'invalid origin';
  end if;

  -- Consent: optional, and validated to the same standard as everything else.
  if p_payload ? 'consent' then
    if jsonb_typeof(p_payload->'consent') <> 'object' then
      raise exception 'consent must be an object';
    end if;
    if exists (select 1 from jsonb_object_keys(p_payload->'consent') k where not (k = any(v_consent_allowed))) then
      raise exception 'unexpected consent key';
    end if;
    v_consent_given := (p_payload->'consent'->>'given')::boolean;
    v_consent_text := nullif(trim(coalesce(p_payload->'consent'->>'text','')), '');
    if length(coalesce(v_consent_text,'')) > 2000 then
      raise exception 'consent text too long';
    end if;
  end if;

  -- Sanitise attribution to the known keys with bounded text values.
  v_attr := '{}'::jsonb;
  if p_payload ? 'attribution' and jsonb_typeof(p_payload->'attribution') = 'object' then
    if exists (select 1 from jsonb_object_keys(p_payload->'attribution') k where not (k = any(v_attr_allowed))) then
      raise exception 'unexpected attribution key';
    end if;
    select coalesce(jsonb_object_agg(k, left(v, 200)), '{}'::jsonb) into v_attr
    from jsonb_each_text(p_payload->'attribution') as e(k, v)
    where v is not null and trim(v) <> '';
  end if;

  v_suppressed := exists (select 1 from do_not_contact where normalized_address = v_email);

  -- Dedupe on the real-lead email. Repeat submissions update the existing lead and
  -- add a fresh touchpoint rather than creating duplicate lead rows.
  select id into v_lead from leads where lower(email) = v_email and synthetic = false for update;
  if found then
    v_duplicate := true;
    update leads set
      name = coalesce(nullif(v_name, ''), name),
      company = coalesce(v_company, company),
      description = coalesce(nullif(v_description, ''), description),
      budget = coalesce(nullif(p_payload->>'budget',''), budget),
      timeline = coalesce(nullif(p_payload->>'timeline',''), timeline),
      source = coalesce(nullif(p_payload->>'source',''), source),
      source_detail = coalesce(nullif(p_payload->>'source_detail',''), source_detail),
      attribution = case when v_attr <> '{}'::jsonb then v_attr else attribution end,
      -- A newer agreement supersedes the stored one; an absent one never erases it.
      consent_given = coalesce(v_consent_given, consent_given),
      consent_text  = case when v_consent_given is not null then v_consent_text else consent_text end,
      consent_at    = case when v_consent_given is not null then now() else consent_at end,
      last_touch_at = now()
    where id = v_lead;
  else
    insert into leads(email, name, synthetic, company, description, budget, timeline,
                      source, source_detail, attribution, status, last_touch_at,
                      consent_given, consent_at, consent_text)
    values (v_email, v_name, false, v_company, nullif(v_description, ''),
            nullif(p_payload->>'budget',''), nullif(p_payload->>'timeline',''),
            nullif(p_payload->>'source',''), nullif(p_payload->>'source_detail',''),
            v_attr, case when v_suppressed then 'suppressed' else 'new' end, now(),
            v_consent_given,
            case when v_consent_given is not null then now() else null end,
            v_consent_text)
    returning id into v_lead;
  end if;

  -- Mirror into contacts so the lead shows in the CRM (see header). Copied from
  -- the lead row after the upsert above, so both records agree. lifecycle_stage
  -- is set only on insert: a repeat submission never demotes a customer.
  if not exists (select 1 from contacts
                 where lower(email) = v_email
                   and not (source = 'lead_migration' and source_record_id = v_lead::text)) then
    insert into contacts (
      company_id, name, email, source, source_record_id, lifecycle_stage,
      budget, timeline, lead_status, consent_given, consent_at, consent_text,
      metadata, synthetic
    )
    select
      (select c.id from companies c
         where lower(c.name) = lower(l.company) order by c.created_at limit 1),
      l.name, l.email, 'lead_migration', l.id::text, 'lead',
      l.budget, l.timeline, l.status, l.consent_given, l.consent_at, l.consent_text,
      jsonb_build_object('migrated_from_lead_id', l.id, 'lead_source', l.source,
                         'lead_source_detail', l.source_detail),
      false
    from leads l where l.id = v_lead
    on conflict (source, source_record_id) do update set
      name = excluded.name,
      budget = excluded.budget,
      timeline = excluded.timeline,
      lead_status = excluded.lead_status,
      consent_given = excluded.consent_given,
      consent_at = excluded.consent_at,
      consent_text = excluded.consent_text,
      metadata = contacts.metadata || excluded.metadata,
      updated_at = now();
  end if;

  insert into touchpoints(lead_id, kind, content, synthetic)
  values (v_lead, v_origin,
          jsonb_build_object(
            'source', nullif(p_payload->>'source',''),
            'sourceDetail', nullif(p_payload->>'source_detail',''),
            'budget', nullif(p_payload->>'budget',''),
            'timeline', nullif(p_payload->>'timeline',''),
            'company', v_company,
            'description', nullif(v_description, ''),
            'attribution', v_attr,
            'consentGiven', v_consent_given,
            'origin', v_origin,
            'suppressed', v_suppressed),
          false)
  returning id into v_touchpoint;

  insert into agent_log(operator, sop, step, lead_id, trigger, payload, outcome, escalated, synthetic)
  values (case v_origin
            when 'manual_entry' then 'crm-manual'
            when 'referral_intake' then 'referral-intake'
            else 'website-intake'
          end,
          '02-sales-pipeline', 'capture', v_lead, v_origin,
          jsonb_build_object('leadId', v_lead, 'touchpointId', v_touchpoint,
                             'duplicate', v_duplicate, 'suppressed', v_suppressed,
                             'consentGiven', v_consent_given,
                             'origin', v_origin,
                             'source', nullif(p_payload->>'source','')),
          'lead_captured', false, false);

  return jsonb_build_object('leadId', v_lead, 'touchpointId', v_touchpoint,
                            'duplicate', v_duplicate, 'suppressed', v_suppressed);
end
$function$;

-- Backfill the real leads captured since the Phase 1 fold, with the same rules.
insert into public.contacts (
  company_id, name, email, source, source_record_id, lifecycle_stage,
  budget, timeline, lead_status, consent_given, consent_at, consent_text,
  metadata, synthetic, created_at
)
select
  (select c.id from public.companies c
     where lower(c.name) = lower(l.company) order by c.created_at limit 1),
  l.name, l.email, 'lead_migration', l.id::text,
  case when l.qualified_at is not null then 'qualified'
       when l.status = 'lost' then 'lost'
       else 'lead' end,
  l.budget, l.timeline, l.status, l.consent_given, l.consent_at, l.consent_text,
  jsonb_build_object('migrated_from_lead_id', l.id, 'lead_source', l.source,
                     'lead_source_detail', l.source_detail),
  l.synthetic, l.created_at
from public.leads l
where l.synthetic = false
  and not exists (select 1 from public.contacts c where lower(c.email) = lower(l.email))
on conflict (source, source_record_id) do nothing;

commit;
