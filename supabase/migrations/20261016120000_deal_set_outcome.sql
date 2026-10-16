-- Mark a deal lost, or reopen it.
--
-- deals.closed_at and deals.lost_reason have existed since the out-of-band
-- baseline and the deal page shows them, but nothing could write them:
-- service_role holds no table privileges, so every write goes through a
-- function. This is the one for these two columns and nothing else.
--
-- "Won" needs no column: a deal that passes stage 4 (Close) is signed, and that
-- gate is already enforced. Lost is the outcome the pipeline could not record.
--
-- A reason closes the deal; null reopens it. A loss without a reason teaches
-- nothing, so an empty reason is refused rather than stored.

create or replace function public.deal_set_outcome(p_deal_id uuid, p_lost_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_lost_reason is not null and (btrim(p_lost_reason) = '' or length(p_lost_reason) > 500) then
    raise exception 'lost reason must be 1 to 500 characters';
  end if;

  update deals
     set lost_reason = btrim(p_lost_reason),
         closed_at   = case when p_lost_reason is null then null else now() end,
         updated_at  = now()
   where id = p_deal_id;
  if not found then
    raise exception 'deal not found: %', p_deal_id;
  end if;
end $$;

revoke all on function public.deal_set_outcome(uuid, text) from public, anon, authenticated;
grant execute on function public.deal_set_outcome(uuid, text) to service_role;
