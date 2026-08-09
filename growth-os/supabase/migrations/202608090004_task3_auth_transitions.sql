alter table public.membership_invitations
  add column accepted_user_id uuid references auth.users(id) on delete set null,
  add column superseded_at timestamptz;

alter table public.membership_invitations
  add constraint membership_invitations_superseded_after_creation
    check (superseded_at is null or superseded_at >= created_at),
  add constraint membership_invitations_single_terminal_state
    check (accepted_at is null or superseded_at is null);

drop index public.membership_invitations_active_tenant_email_idx;

create unique index membership_invitations_current_tenant_email_idx
on public.membership_invitations (tenant_id, email)
where accepted_at is null and superseded_at is null;

create function public.prepare_membership_invitation(
  target_tenant uuid,
  invitation_email text,
  inviter_user_id uuid,
  invitation_token_hash text,
  invitation_expires_at timestamptz,
  event_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_invitation_id uuid;
  prepared_at timestamptz := clock_timestamp();
begin
  if invitation_email is null
    or invitation_email <> lower(invitation_email)
    or invitation_email !~ '^[^[:space:]@]+@[^[:space:]@]+$'
    or char_length(invitation_email) not between 3 and 320 then
    raise exception using errcode = '22023', message = 'invalid invitation email';
  end if;

  if invitation_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid invitation token hash';
  end if;

  if invitation_expires_at is null
    or invitation_expires_at <= prepared_at
    or invitation_expires_at > prepared_at + interval '7 days' then
    raise exception using errcode = '22023', message = 'invalid invitation expiry';
  end if;

  if event_request_id is null then
    raise exception using errcode = '22004', message = 'request id is required';
  end if;

  if not exists (select 1 from public.tenants where id = target_tenant) then
    raise exception using errcode = '23503', message = 'tenant not found';
  end if;

  if not exists (
    select 1 from public.platform_admins where user_id = inviter_user_id
  ) then
    raise exception using errcode = '42501', message = 'platform administrator required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_tenant::text || ':' || invitation_email, 0)
  );

  update public.membership_invitations
  set superseded_at = prepared_at
  where tenant_id = target_tenant
    and email = invitation_email
    and accepted_at is null
    and superseded_at is null
    and expires_at <= prepared_at;

  select id
  into current_invitation_id
  from public.membership_invitations
  where tenant_id = target_tenant
    and email = invitation_email
    and accepted_at is null
    and superseded_at is null
    and expires_at > prepared_at
  order by created_at desc, id
  limit 1
  for update;

  if current_invitation_id is null then
    insert into public.membership_invitations (
      tenant_id,
      email,
      role,
      invited_by,
      token_hash,
      expires_at,
      created_at
    )
    values (
      target_tenant,
      invitation_email,
      'client_owner',
      inviter_user_id,
      invitation_token_hash,
      invitation_expires_at,
      prepared_at
    )
    returning id into current_invitation_id;
  end if;

  if not exists (
    select 1
    from public.audit_events
    where tenant_id = target_tenant
      and action = 'membership.invited'
      and target_type = 'membership_invitation'
      and target_id = current_invitation_id
  ) then
    perform public.write_audit_event(
      target_tenant,
      'membership.invited',
      'membership_invitation',
      current_invitation_id,
      event_request_id,
      jsonb_build_object('channel', 'magic_link'),
      inviter_user_id
    );
  end if;

  return current_invitation_id;
end;
$$;

create function public.accept_membership_invitation(
  invitation_id uuid,
  target_tenant uuid,
  invited_user_id uuid,
  invited_email text,
  event_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted_at_time timestamptz := clock_timestamp();
  invitation_record public.membership_invitations%rowtype;
  user_email text;
begin
  if event_request_id is null then
    raise exception using errcode = '22004', message = 'request id is required';
  end if;

  select lower(email)
  into user_email
  from auth.users
  where id = invited_user_id;

  if user_email is null or user_email <> lower(invited_email) then
    raise exception using errcode = '42501', message = 'invited user does not match';
  end if;

  select *
  into invitation_record
  from public.membership_invitations
  where id = invitation_id
    and tenant_id = target_tenant
    and email = user_email
  for update;

  if not found or invitation_record.superseded_at is not null then
    raise exception using errcode = 'P0002', message = 'invitation not found';
  end if;

  if invitation_record.accepted_at is null then
    if invitation_record.expires_at <= accepted_at_time then
      raise exception using errcode = '22023', message = 'invitation expired';
    end if;

    update public.membership_invitations
    set
      accepted_at = accepted_at_time,
      accepted_user_id = invited_user_id
    where id = invitation_id;
  elsif invitation_record.accepted_user_id is null and exists (
    select 1
    from public.memberships
    where tenant_id = target_tenant
      and user_id = invited_user_id
      and role = 'client_owner'
  ) then
    update public.membership_invitations
    set accepted_user_id = invited_user_id
    where id = invitation_id;
  elsif invitation_record.accepted_user_id is distinct from invited_user_id then
    raise exception using errcode = '42501', message = 'invitation already accepted';
  end if;

  insert into public.memberships (tenant_id, user_id, role)
  values (target_tenant, invited_user_id, 'client_owner')
  on conflict (tenant_id, user_id) do nothing;

  if not exists (
    select 1
    from public.audit_events
    where tenant_id = target_tenant
      and action = 'membership.changed'
      and target_type = 'membership_invitation'
      and target_id = invitation_id
  ) then
    perform public.write_audit_event(
      target_tenant,
      'membership.changed',
      'membership_invitation',
      invitation_id,
      event_request_id,
      jsonb_build_object('change_code', 'invitation_accepted'),
      invited_user_id
    );
  end if;

  return true;
end;
$$;

revoke all on function public.prepare_membership_invitation(
  uuid,
  text,
  uuid,
  text,
  timestamptz,
  uuid
) from public;
revoke all on function public.accept_membership_invitation(
  uuid,
  uuid,
  uuid,
  text,
  uuid
) from public;

grant execute on function public.prepare_membership_invitation(
  uuid,
  text,
  uuid,
  text,
  timestamptz,
  uuid
) to service_role;
grant execute on function public.accept_membership_invitation(
  uuid,
  uuid,
  uuid,
  text,
  uuid
) to service_role;
