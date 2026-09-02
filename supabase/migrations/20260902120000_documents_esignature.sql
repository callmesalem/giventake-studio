-- Documents and e-signature.
--
-- pipeline_stages names an artifact for all twelve stages and nothing could hold
-- one. This adds the storage, and the signature that makes stage 4's gate -
-- "Signed and paid before any code" - a fact rather than a convention.
--
-- The rendered markdown IS the artifact. There is no bucket and no PDF:
-- Cloudflare Workers has no headless browser, and a hash over the stored bytes
-- is better evidence than a file nobody can diff.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals on delete cascade,
  project_id uuid references public.projects on delete cascade,
  stage_number integer,
  doc_type text not null,
  title text not null,
  body text not null,
  body_hash text not null,
  template_id text,
  status text not null default 'draft',
  owner_id uuid,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- An artifact attached to neither belongs to nothing and cannot be found again.
  check (deal_id is not null or project_id is not null),
  check (status in ('draft', 'final', 'superseded'))
);

create index if not exists documents_deal_idx on public.documents (deal_id) where deal_id is not null;

-- One row per requested signature.
--
-- document_hash is a COPY, taken when the request is sent. It is not a
-- duplicate of documents.body_hash by accident: editing the document afterwards
-- must not retroactively change what was signed, and a mismatch between the two
-- is how a signature against a superseded version becomes detectable instead of
-- silent.
--
-- consent_text is stored verbatim for the same reason. Proving somebody
-- consented requires knowing what they were shown, and that wording will be
-- edited over time.
create table if not exists public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents on delete cascade,
  recipient_name text not null,
  recipient_email text not null,
  recipient_role text,
  signing_token text not null default gen_random_uuid()::text,
  status text not null default 'pending',
  sent_by uuid,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),

  -- Written on GET, so a mail scanner can trigger it. Advisory, never evidence.
  viewed_at timestamptz,

  signed_at timestamptz,
  signed_name text,
  consent_text text,
  document_hash text not null,
  declined_reason text,
  signature_ip text,
  signature_user_agent text,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),

  check (status in ('pending', 'viewed', 'signed', 'declined', 'expired'))
);

create unique index if not exists document_signatures_token_uidx
  on public.document_signatures (signing_token);

create index if not exists document_signatures_document_idx
  on public.document_signatures (document_id);

-- The witness that did not exist when deal_advance_stage was written.
--
-- That RPC deliberately does not assert gates, because most of them - "Problem
-- understood, quantified", "Client saw it working each week" - are human
-- judgements a function cannot witness. Stage 4's gate is different in kind: a
-- signature is a fact with a record. This function is that record.
create or replace function public.deal_has_signed_sow(p_deal_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from document_signatures s
    join documents d on d.id = s.document_id
    where d.deal_id = p_deal_id
      and d.doc_type = 'sow'
      and s.status = 'signed'
      and not coalesce(d.synthetic, false)
  );
$$;

revoke all on function public.deal_has_signed_sow(uuid) from public;
grant execute on function public.deal_has_signed_sow(uuid) to service_role;

alter table public.documents enable row level security;
alter table public.document_signatures enable row level security;

-- The RPC surface.
--
-- RLS is enabled above with no policies, which is not an oversight: it means
-- there is no such thing as reading these tables directly. Every path in is one
-- of the narrow SECURITY DEFINER functions below, granted only to service_role
-- - the same posture as the campaign engine and src/server/crm/read.ts. The
-- server holds the key; the browser never sees it and has no table to reach.

create or replace function public.document_create(
  p_deal_id uuid,
  p_project_id uuid,
  p_stage_number integer,
  p_doc_type text,
  p_title text,
  p_body text,
  p_body_hash text,
  p_template_id text,
  p_owner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into documents (
    deal_id, project_id, stage_number, doc_type,
    title, body, body_hash, template_id, owner_id
  )
  values (
    p_deal_id, p_project_id, p_stage_number, p_doc_type,
    p_title, p_body, p_body_hash, p_template_id, p_owner_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.document_create(uuid, uuid, integer, text, text, text, text, text, uuid) from public;
grant execute on function public.document_create(uuid, uuid, integer, text, text, text, text, text, uuid) to service_role;

-- Replace an edited draft's body and re-hash it.
--
-- Only 'draft' and 'final' are reachable from here. 'superseded' is retirement,
-- a different act with different consequences, and a routine save must not be
-- able to perform it by passing a string.
create or replace function public.document_update_body(
  p_id uuid,
  p_body text,
  p_body_hash text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('draft', 'final') then
    raise exception 'document_update_body: status must be draft or final, got %', p_status;
  end if;

  update documents
     set body = p_body,
         body_hash = p_body_hash,
         status = p_status,
         updated_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.document_update_body(uuid, text, text, text) from public;
grant execute on function public.document_update_body(uuid, text, text, text) to service_role;

-- Send a signature request.
--
-- signing_token comes from the column default, never from the caller, so the
-- token is unguessable by construction. Returning it here is the only time it
-- is readable, which is why this returns an object rather than just an id.
create or replace function public.document_request_signature(
  p_document_id uuid,
  p_recipient_name text,
  p_recipient_email text,
  p_document_hash text,
  p_sent_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_token text;
begin
  insert into document_signatures (
    document_id, recipient_name, recipient_email, document_hash, sent_by
  )
  values (
    p_document_id, p_recipient_name, p_recipient_email, p_document_hash, p_sent_by
  )
  returning id, signing_token into v_id, v_token;

  return jsonb_build_object('id', v_id, 'signing_token', v_token);
end;
$$;

revoke all on function public.document_request_signature(uuid, text, text, text, uuid) from public;
grant execute on function public.document_request_signature(uuid, text, text, text, uuid) to service_role;

-- Everything the public sign page needs, in one round trip.
--
-- The document's title and body are joined in rather than fetched separately:
-- two calls could straddle an edit and render a body that does not match the
-- hash shown beside it. Returns null when the token is unknown - a stale link
-- is an ordinary outcome, not an error.
create or replace function public.document_find_by_token(p_token text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'id', s.id,
    'document_id', s.document_id,
    'recipient_name', s.recipient_name,
    'recipient_email', s.recipient_email,
    'signing_token', s.signing_token,
    'status', s.status,
    'expires_at', s.expires_at,
    'signed_at', s.signed_at,
    'signed_name', s.signed_name,
    'document_hash', s.document_hash,
    'title', d.title,
    'body', d.body
  )
  from document_signatures s
  join documents d on d.id = s.document_id
  where s.signing_token = p_token;
$$;

revoke all on function public.document_find_by_token(text) from public;
grant execute on function public.document_find_by_token(text) to service_role;

-- Advisory only, and deliberately one-way.
--
-- The guard is `status = 'pending'`, not `id = p_id` alone: this is written on
-- GET, so anything that follows the link - a mail scanner, a browser prefetch,
-- the signer reopening the tab afterwards - can trigger it. Without the guard a
-- fetch after signing would rewrite a signed row back to 'viewed'.
create or replace function public.document_mark_viewed(p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update document_signatures
     set viewed_at = now(),
         status = 'viewed'
   where id = p_id
     and status = 'pending';
$$;

revoke all on function public.document_mark_viewed(uuid) from public;
grant execute on function public.document_mark_viewed(uuid) to service_role;

-- Record the signature. The boolean is the replay guard.
--
-- A resubmitted POST - a double click, a retried request, a replayed link -
-- must not overwrite an existing signature with a later timestamp, a different
-- name, or a different IP. The status predicate makes that impossible, and
-- returning whether a row was touched lets the caller answer "already signed"
-- instead of reporting a write that never happened.
--
-- Both halves live here rather than in TypeScript so the check and the write
-- are one statement. A read-then-write in the caller could interleave with a
-- concurrent submission and record two signatures against one request.
create or replace function public.document_mark_signed(
  p_id uuid,
  p_signed_name text,
  p_consent_text text,
  p_ip text,
  p_user_agent text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  update document_signatures
     set status = 'signed',
         signed_at = now(),
         signed_name = p_signed_name,
         consent_text = p_consent_text,
         signature_ip = p_ip,
         signature_user_agent = p_user_agent
   where id = p_id
     and status in ('pending', 'viewed');

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.document_mark_signed(uuid, text, text, text, text) from public;
grant execute on function public.document_mark_signed(uuid, text, text, text, text) to service_role;
