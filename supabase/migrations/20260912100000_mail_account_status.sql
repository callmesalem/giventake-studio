-- Reading the connected mailbox's identity and health, for the app.
--
-- 20260912090000 gave the app no way to ask whether a mailbox is connected:
-- mail_account_for_sync is agent-only and returns ciphertext. So the inbox
-- derived "connected" from an env var, which can disagree with the database in
-- both directions and reports a reauth_required account as healthy. This is the
-- app-facing counterpart: identity and health, never a token.

create or replace function public.mail_account_status()
returns table (email text, status text)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select email, status
  from mail_accounts
  order by created_at asc
  limit 1;
$$;

revoke all on function public.mail_account_status() from public;
grant execute on function public.mail_account_status() to service_role;
