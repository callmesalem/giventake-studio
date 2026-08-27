-- Record the consent the contact form already collects.
--
-- The form requires a consent checkbox and src/lib/intake.ts validates it, but
-- the value was discarded at the client: contact.tsx destructured it away before
-- calling the server function, and capture_website_lead's payload allowlist
-- would have rejected it anyway. So every lead was captured under an agreement
-- we kept no record of.
--
-- Changes, all backwards compatible:
--   * 'consent' joins the payload allowlist. It stays OPTIONAL - existing
--     callers that send nothing keep working unchanged.
--   * consent_given / consent_at / consent_text are written on insert.
--   * On a repeat submission a fresh consent OVERWRITES the stored one, because
--     the newer agreement is the operative one. Absent consent never clears an
--     existing record: a caller omitting the field must not erase evidence.
--   * The touchpoint payload carries the consent flag, so the audit trail shows
--     it per submission rather than only as current state on the lead.
--
-- consent_text holds the wording displayed at the time. The client sends the
-- same constant it rendered, so the stored words are provably the words shown.

create or replace function public.capture_website_lead(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allowed text[] := array['email','name','company','description','budget','timeline','source','source_detail','attribution','consent'];
  v_attr_allowed text[] := array['utm_source','utm_medium','utm_campaign','utm_content','utm_term','referrer'];
  v_consent_allowed text[] := array['given','text'];
  v_email text;
  v_name text;
  v_company text;
  v_description text;
  v_attr jsonb;
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

  insert into touchpoints(lead_id, kind, content, synthetic)
  values (v_lead, 'website_contact_form',
          jsonb_build_object(
            'source', nullif(p_payload->>'source',''),
            'sourceDetail', nullif(p_payload->>'source_detail',''),
            'budget', nullif(p_payload->>'budget',''),
            'timeline', nullif(p_payload->>'timeline',''),
            'company', v_company,
            'description', nullif(v_description, ''),
            'attribution', v_attr,
            'consentGiven', v_consent_given,
            'suppressed', v_suppressed),
          false)
  returning id into v_touchpoint;

  insert into agent_log(operator, sop, step, lead_id, trigger, payload, outcome, escalated, synthetic)
  values ('website-intake', '02-sales-pipeline', 'capture', v_lead, 'contact_form',
          jsonb_build_object('leadId', v_lead, 'touchpointId', v_touchpoint,
                             'duplicate', v_duplicate, 'suppressed', v_suppressed,
                             'consentGiven', v_consent_given,
                             'source', nullif(p_payload->>'source','')),
          'lead_captured', false, false);

  return jsonb_build_object('leadId', v_lead, 'touchpointId', v_touchpoint,
                            'duplicate', v_duplicate, 'suppressed', v_suppressed);
end
$$;

comment on function public.capture_website_lead(jsonb) is
  'Website contact-form intake. Track-only: never sends, never starts an operator run. Records consent evidence (consent_given/at/text) when the caller supplies it; the consent key is optional so older callers keep working.';
