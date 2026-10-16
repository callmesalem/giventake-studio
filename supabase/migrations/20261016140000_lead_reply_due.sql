-- First reply due on new leads.
--
-- Trades hire whoever calls back first, so a new lead should carry a deadline
-- the CRM can show and colour. contacts.next_action / next_action_due have
-- existed since phase 1 but nothing wrote them.
--
-- 1. A new lead mirrored into contacts (capture_website_lead inserts with
--    source = 'lead_migration', for website and manual entry alike) gets
--    "Reply to new lead", due four hours later, unless something already set
--    a next action.
--    ponytail: a flat four hours, weekends included; switch to business hours
--    if Saturday leads keep showing overdue for no reason.
--
-- 2. contact_set_next_action lets the dashboard mark it done (null) or set the
--    next step. service_role only, like the other dashboard write RPCs.

create or replace function public.contacts_default_reply_due()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.source = 'lead_migration' and new.lifecycle_stage = 'lead' and new.next_action is null then
    new.next_action := 'Reply to new lead';
    new.next_action_due := now() + interval '4 hours';
  end if;
  return new;
end $$;

revoke all on function public.contacts_default_reply_due() from public, anon, authenticated;

drop trigger if exists contacts_default_reply_due on public.contacts;
create trigger contacts_default_reply_due
  before insert on public.contacts
  for each row execute function public.contacts_default_reply_due();

create or replace function public.contact_set_next_action(
  p_contact_id uuid, p_action text, p_due timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_action is not null and (btrim(p_action) = '' or length(p_action) > 300) then
    raise exception 'next action must be 1 to 300 characters';
  end if;

  update contacts
     set next_action     = btrim(p_action),
         next_action_due = case when p_action is null then null else p_due end,
         updated_at      = now()
   where id = p_contact_id;
  if not found then
    raise exception 'contact not found: %', p_contact_id;
  end if;
end $$;

revoke all on function public.contact_set_next_action(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.contact_set_next_action(uuid, text, timestamptz) to service_role;
