-- The write half of mail_accounts that 20260912090000 and 20260912100000 left
-- out. Between them, the schema could sync an existing account and read its
-- status, but nothing could ever create the row or move it into
-- reauth_required. The VPS OAuth connect flow had nothing to call, and a
-- rejected refresh token had no way to surface as anything but silence. See
-- docs/integrations/gmail-poller-contract.md sections 2 and 8.

-- ── Called once by the OAuth connect flow, on the VPS. ───────────────────────
--
-- Upserts on `email` because `mail_accounts.email` is already not null unique,
-- and reconnecting the same mailbox must update the existing row rather than
-- fail or create a second one — Phase 1 assumes exactly one `mail_accounts`
-- row (see the poller contract, section 2) and this is what keeps a reconnect
-- from breaking that. `history_id` is deliberately untouched on reconnect: the
-- cursor stays valid across a reconnect, and clearing it would force a
-- needless backfill.
create or replace function public.mail_account_connect(
  p_email text,
  p_google_sub text,
  p_refresh_token_enc text,
  p_access_token_enc text,
  p_token_expires_at timestamptz,
  p_connected_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_email is null or btrim(p_email) = '' then
    raise exception 'mail_account_connect: email must not be blank';
  end if;

  -- A connect with no refresh token produces an account that can never sync,
  -- which is worse than no account at all.
  if p_refresh_token_enc is null or btrim(p_refresh_token_enc) = '' then
    raise exception 'mail_account_connect: refresh_token_enc must not be blank';
  end if;

  insert into mail_accounts (
    email, google_sub, refresh_token_enc, access_token_enc,
    token_expires_at, connected_by, status
  )
  values (
    p_email, p_google_sub, p_refresh_token_enc, p_access_token_enc,
    p_token_expires_at, p_connected_by, 'connected'
  )
  on conflict (email) do update
    set google_sub = excluded.google_sub,
        refresh_token_enc = excluded.refresh_token_enc,
        access_token_enc = excluded.access_token_enc,
        token_expires_at = excluded.token_expires_at,
        connected_by = excluded.connected_by,
        status = 'connected',
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ── Called when Google rejects a refresh token at step 1 of the poll loop. ──
--
-- This is what makes the inbox's "connection needs renewing" message appear:
-- the app learns the mailbox is unhealthy only through mail_account_status(),
-- and that function only ever reports what this one writes.
create or replace function public.mail_account_set_status(
  p_account_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('connected', 'reauth_required', 'disabled') then
    raise exception 'mail_account_set_status: invalid status %', p_status;
  end if;

  update mail_accounts
     set status = p_status, updated_at = now()
   where id = p_account_id;

  if not found then
    raise exception 'mail_account_set_status: no account with id %', p_account_id;
  end if;
end;
$$;

revoke all on function public.mail_account_connect(text, text, text, text, timestamptz, uuid) from public;
revoke all on function public.mail_account_set_status(uuid, text) from public;

-- Deliberately NOT service_role, unlike every other function in this schema.
-- The Worker holds no encryption key, so it could only ever write a garbage
-- token through mail_account_connect, and it has no legitimate reason to call
-- mail_account_set_status: disabling or reauth-flagging a mailbox is a
-- decision made from a decrypted Google response, which only the VPS ever
-- sees. Writing credentials is the VPS's job alone. This is a tightening, not
-- an oversight — do not "fix" it later by adding service_role back.
--
-- Both roles, not one, for the same reason as the four sync functions in
-- 20260912090000_mail_surface.sql: docs/operations/operator-control/agent-capabilities.md:155
-- says Sami connects as crm_agent today, and setting agent_sami's password is
-- step 2 of a cutover that has not happened. Granting only agent_sami would
-- leave the connect flow and the poller's status write unusable until that
-- cutover runs.
grant execute on function public.mail_account_connect(text, text, text, text, timestamptz, uuid) to crm_agent, agent_sami;
grant execute on function public.mail_account_set_status(uuid, text) to crm_agent, agent_sami;
