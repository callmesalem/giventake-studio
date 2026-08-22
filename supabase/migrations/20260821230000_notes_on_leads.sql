-- Let a note attach to a lead.
--
-- notes could only reference company_id, so there was no way to write anything
-- against a lead. Qualifying a lead and recording what you learned - the whole
-- point of SOP W.2 and W.4 - had nowhere to go. The only workaround was to
-- convert the lead first, which inverts the process: you note in order to
-- decide whether to convert.
--
-- Additive: lead_id is nullable, every existing note keeps working, and a note
-- may carry a company, a lead, both, or neither.

begin;

alter table public.notes
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

comment on column public.notes.lead_id is
  'Lead this note is about. Independent of company_id: a note can belong to a lead before that lead has a company, and an account note can belong to a company with no lead.';

create index if not exists notes_lead_idx on public.notes (lead_id);

-- note_upsert has to be REPLACED rather than extended. Adding a defaulted
-- parameter would create a second overload, and a six-argument call would then
-- be ambiguous between the two - an error, not a fallback. Dropping and
-- recreating inside this transaction means there is no window where the
-- function is missing.
drop function if exists public.note_upsert(text, text, uuid, text, text, jsonb);

create function public.note_upsert(
  p_source text,
  p_source_record_id text,
  p_company_id uuid,
  p_title text,
  p_content text,
  p_metadata jsonb,
  p_lead_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

comment on function public.note_upsert(text, text, uuid, text, text, jsonb, uuid) is
  'Upsert a note keyed on (source, source_record_id). p_lead_id is optional and defaults to null, so existing six-argument callers behave exactly as before.';

-- The old grants died with the function.
revoke all on function public.note_upsert(text, text, uuid, text, text, jsonb, uuid) from public;
grant execute on function public.note_upsert(text, text, uuid, text, text, jsonb, uuid)
  to service_role, crm_agent;

commit;
