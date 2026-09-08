# The write functions `crm_agent` can call — captured from production

**Captured:** 2026-09-06, project `qsgijpsttojutuhogbns`, via `pg_get_functiondef`.
**Why:** Task 1 of `docs/superpowers/plans/2026-09-06-agent-capability-model.md`.
The capability guard re-creates every one of these, so the bodies below are the
starting point.

## How this set was derived

Not by hand. An earlier pass enumerated by reading migrations, counted nine, and
missed `referral_set_status`. The set is whatever this returns:

```sql
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_functiondef(p.oid) as def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join lateral aclexplode(p.proacl) a on true
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public'
  and r.rolname = 'crm_agent'
  and a.privilege_type = 'EXECUTE'
  and lower(p.prosrc) ~ '\minsert\M|\mupdate\M|\mdelete\M'
order by p.proname;
```

**Ten rows.** `crm_agent` holds EXECUTE on 22 functions in total: these ten mutate
(all `volatile`), the other twelve do not (all `stable`). The split is clean — no
function claims `stable` while writing.

## Drift against the repo

Nine of the ten have a definition under `supabase/migrations/`. Each was compared
body-to-body against production, normalising whitespace and case:

| Function | Repo migration | Result |
|---|---|---|
| `approval_request` | `20260818190000_approval_queue.sql` | identical |
| `company_upsert` | `20260818180000_prospecting_layer.sql` | identical |
| `contact_upsert` | `20260818180000_prospecting_layer.sql` | identical |
| `deal_upsert` | `20260818180000_prospecting_layer.sql` | identical |
| `note_upsert` | `20260821230000_notes_on_leads.sql` | identical |
| `referral_partner_upsert` | `20260818160000_referral_suite.sql` | identical |
| `referral_record` | `20260818160000_referral_suite.sql` | identical |
| `referral_set_status` | `20260818160000_referral_suite.sql` | identical |
| `task_upsert` | `20260818200000_notes_tasks.sql` | identical |
| `deal_advance_stage` | **none** | **recovered from production** |

**No drift.** Nine of nine match, so the repo is the source of truth for
everything it defines.

`note_upsert` is defined twice in the migration history — first in
`20260818200000_notes_tasks.sql`, then re-created with `p_lead_id` in
`20260821230000_notes_on_leads.sql`. The later one is what runs, and is what was
compared.

### `deal_advance_stage` has no committed source

It runs in production, is granted to `crm_agent`, and is referenced by
`src/server/crm/actions.ts` and Lovable's generated `types.ts` — but no migration
creates it. The definition below is recovered from `pg_get_functiondef`, and this
document is currently its only home in the repo. The capability migration commits
it properly as a side effect of adding the guard.

Same class of drift as the `giventake-mcp` source that lived only on a dead
branch: a live, granted, agent-callable object whose source existed solely inside
the running system.

### One signature detail that is easy to lose

`note_upsert`'s last parameter is `p_lead_id uuid DEFAULT NULL::uuid`. Re-creating
it without the default silently breaks every six-argument caller. Preserve it.

## The definitions

Verbatim from `pg_get_functiondef`. Every one is `SECURITY DEFINER` owned by
`postgres`, with `search_path` pinned — which is exactly why the guard must read
`session_user` and never `current_user`.

```sql
CREATE OR REPLACE FUNCTION public.approval_request(p_agent_name text, p_action_type text, p_target_type text, p_target_id text, p_summary text, p_payload jsonb, p_risk_level text, p_expires_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
  if coalesce(p_risk_level,'medium') not in ('low','medium','high','critical') then
    raise exception 'invalid risk level';
  end if;
  if p_payload is not null and jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be an object';
  end if;
  insert into approval_queue(agent_name,action_type,target_type,target_id,summary,proposed_payload,risk_level,expires_at)
    values(p_agent_name,p_action_type,p_target_type,p_target_id,p_summary,
           coalesce(p_payload,'{}'::jsonb), coalesce(p_risk_level,'medium'), p_expires_at)
    returning id into v_id;
  return v_id;
end $function$
```

```sql
CREATE OR REPLACE FUNCTION public.company_upsert(p_source text, p_source_record_id text, p_name text, p_domain text, p_description text, p_categories jsonb, p_employee_range text, p_location text, p_socials jsonb, p_metadata jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
  insert into companies(source,source_record_id,name,domain,description,categories,employee_range,location,socials,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_name, p_domain, p_description,
           coalesce(p_categories,'[]'::jsonb), p_employee_range, p_location,
           coalesce(p_socials,'{}'::jsonb), coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      name=excluded.name, domain=excluded.domain, description=excluded.description,
      categories=excluded.categories, employee_range=excluded.employee_range,
      location=excluded.location, socials=excluded.socials, metadata=excluded.metadata,
      updated_at=now()
    returning id into v_id;
  return v_id;
end $function$
```

```sql
CREATE OR REPLACE FUNCTION public.contact_upsert(p_source text, p_source_record_id text, p_company_id uuid, p_name text, p_email text, p_phone text, p_job_title text, p_socials jsonb, p_metadata jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
  insert into contacts(source,source_record_id,company_id,name,email,phone,job_title,socials,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_company_id, p_name, p_email,
           p_phone, p_job_title, coalesce(p_socials,'{}'::jsonb), coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      company_id=excluded.company_id, name=excluded.name, email=excluded.email,
      phone=excluded.phone, job_title=excluded.job_title, socials=excluded.socials,
      metadata=excluded.metadata, updated_at=now()
    returning id into v_id;
  return v_id;
end $function$
```

```sql
CREATE OR REPLACE FUNCTION public.deal_advance_stage(p_deal_id uuid, p_to_stage text, p_note text, p_actor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_from_stage text;
  v_event_id uuid;
begin
  if not exists (select 1 from pipeline_stages where name = p_to_stage) then
    raise exception 'unknown pipeline stage: %', p_to_stage;
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'note is required to advance a deal stage (state the evidence, not just the destination)';
  end if;
  if p_actor is null or btrim(p_actor) = '' then
    raise exception 'actor is required to advance a deal stage';
  end if;

  select stage into v_from_stage from deals where id = p_deal_id for update;
  if not found then
    raise exception 'deal not found: %', p_deal_id;
  end if;

  update deals set stage = p_to_stage, updated_at = now() where id = p_deal_id;

  insert into deal_stage_events (deal_id, from_stage, to_stage, note, actor)
    values (p_deal_id, v_from_stage, p_to_stage, p_note, p_actor)
    returning id into v_event_id;

  return jsonb_build_object(
    'eventId', v_event_id,
    'dealId', p_deal_id,
    'fromStage', v_from_stage,
    'toStage', p_to_stage
  );
end $function$
```

```sql
CREATE OR REPLACE FUNCTION public.deal_upsert(p_source text, p_source_record_id text, p_company_id uuid, p_name text, p_stage text, p_value_usd numeric, p_metadata jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
  insert into deals(source,source_record_id,company_id,name,stage,value_usd,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_company_id, p_name, p_stage,
           p_value_usd, coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      company_id=excluded.company_id, name=excluded.name, stage=excluded.stage,
      value_usd=excluded.value_usd, metadata=excluded.metadata, updated_at=now()
    returning id into v_id;
  return v_id;
end $function$
```

```sql
CREATE OR REPLACE FUNCTION public.note_upsert(p_source text, p_source_record_id text, p_company_id uuid, p_title text, p_content text, p_metadata jsonb, p_lead_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
  insert into notes(source,source_record_id,company_id,lead_id,title,content,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_company_id, p_lead_id,
           p_title, p_content, coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      company_id=excluded.company_id, lead_id=excluded.lead_id, title=excluded.title,
      content=excluded.content, metadata=excluded.metadata, updated_at=now()
    returning id into v_id;
  return v_id;
end
$function$
```

```sql
CREATE OR REPLACE FUNCTION public.referral_partner_upsert(p_id uuid, p_name text, p_kind text, p_contact_email text, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$
```

```sql
CREATE OR REPLACE FUNCTION public.referral_record(p_partner_id uuid, p_lead_id uuid, p_company_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
  insert into referrals(partner_id, lead_id, company_name)
    values(p_partner_id, p_lead_id, p_company_name)
    returning id into v_id;
  return v_id;
end $function$
```

```sql
CREATE OR REPLACE FUNCTION public.referral_set_status(p_id uuid, p_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_count bigint;
begin
  if p_status not in ('received','qualified','converted','declined') then
    raise exception 'invalid status';
  end if;
  update referrals set status=p_status, updated_at=now() where id=p_id;
  get diagnostics v_count = row_count;
  return v_count > 0;
end $function$
```

```sql
CREATE OR REPLACE FUNCTION public.task_upsert(p_source text, p_source_record_id text, p_company_id uuid, p_content text, p_is_completed boolean, p_deadline_at timestamp with time zone, p_metadata jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
  insert into tasks(source,source_record_id,company_id,content,is_completed,deadline_at,metadata)
    values(coalesce(p_source,'manual'), p_source_record_id, p_company_id, p_content, coalesce(p_is_completed,false), p_deadline_at, coalesce(p_metadata,'{}'::jsonb))
    on conflict (source, source_record_id) do update set
      company_id=excluded.company_id, content=excluded.content, is_completed=excluded.is_completed,
      deadline_at=excluded.deadline_at, metadata=excluded.metadata, updated_at=now()
    returning id into v_id;
  return v_id;
end $function$
```
