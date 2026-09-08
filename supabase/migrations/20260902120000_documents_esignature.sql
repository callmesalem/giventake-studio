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
-- signed_body and document_hash are a COPY of the document, taken when the
-- request is sent, and together they are the evidentiary record.
--
-- The hash alone was not. documents.body is overwritten in place by
-- document_update_body and there is no version history, so a stored hash with
-- no preimage can only ever prove that what you still hold is NOT what was
-- signed. It cannot produce what was. In a dispute that is worse than useless,
-- because the party relying on it is the one who loses.
--
-- So the bytes travel with the hash. Editing the document afterwards changes
-- neither, and a mismatch between document_hash and the document row is how a
-- signature against a superseded version stays detectable instead of silent.
--
-- Both are written by document_request_signature FROM THE DOCUMENTS ROW, never
-- from a caller-supplied value - see the note on that function.
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

  -- The preimage of document_hash: the exact bytes this recipient was asked to
  -- sign. not null because document_request_signature is the only thing that
  -- writes this table, and it always has the body in hand.
  signed_body text not null,
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

-- RLS is not the whole lock, and these were the only tables in the schema
-- treating it as though it were.
--
-- Postgres' default ACL grants ALL on a new table to anon and authenticated,
-- so on `db push` both of these would be created carrying those grants. RLS
-- with no policies denies every row today, so nothing leaks - but that leaves
-- one permissive policy standing between signed contracts and anybody holding
-- the publishable key.
--
-- Every sibling migration revokes as well as enabling; see
-- 20260814133600_operator_control_foundation.sql. These now match.
revoke all on table public.documents, public.document_signatures from anon, authenticated;

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
--
-- The snapshot is taken FROM THE DOCUMENTS ROW, inside this function. The
-- caller does not supply the bytes or the hash to store, because a caller that
-- can choose the evidence can choose evidence that never existed - and the
-- whole value of this record is that nothing upstream of the database picked
-- it.
--
-- p_expected_hash is therefore a PRECONDITION, not data. It is what the caller
-- believes it is sending, and if the document has moved on since the caller
-- read it - another tab finalised an edit, the page has been open a while -
-- this writes nothing and returns null. The TypeScript layer already refuses
-- on a stale hash before calling; asserting it here as well closes the window
-- between that read and this insert, and makes the guarantee a property of the
-- table rather than of remembering to check.
--
-- Null is also the answer for an unknown document id, for the same reason: no
-- row was written, and the caller must not be told one was.
create or replace function public.document_request_signature(
  p_document_id uuid,
  p_recipient_name text,
  p_recipient_email text,
  p_expected_hash text,
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
  v_body text;
  v_hash text;
begin
  select body, body_hash
    into v_body, v_hash
    from documents
   where id = p_document_id;

  if not found then
    return null;
  end if;

  -- "is distinct from" rather than "<>": a null on either side must refuse,
  -- and "<>" would yield null, which the if treats as not-true and would fall
  -- straight through to the insert.
  if v_hash is distinct from p_expected_hash then
    return null;
  end if;

  insert into document_signatures (
    document_id, recipient_name, recipient_email, document_hash, signed_body, sent_by
  )
  values (
    p_document_id, p_recipient_name, p_recipient_email, v_hash, v_body, p_sent_by
  )
  returning id, signing_token into v_id, v_token;

  return jsonb_build_object('id', v_id, 'signing_token', v_token);
end;
$$;

revoke all on function public.document_request_signature(uuid, text, text, text, uuid) from public;
grant execute on function public.document_request_signature(uuid, text, text, text, uuid) to service_role;

-- Everything the public sign page needs, in one round trip.
--
-- The body served here is the SIGNATURE'S snapshot, not documents.body. They
-- are the same bytes at send time and can diverge afterwards, because
-- document_update_body overwrites the document in place. Serving the live body
-- would show a signer one document while recording the hash of another;
-- serving the snapshot means the page, the hash, and the stored preimage are
-- all the same thing.
--
-- A post-send edit is surfaced to the OPERATOR instead, by signatureIsStale
-- comparing document_hash against the document's current body_hash. The
-- remedy for one is to send a fresh request, never to move the request
-- already in flight under the person reading it.
--
-- The title still comes from the document: it is a label on the page, not part
-- of the signed bytes. Returns null when the token is unknown - a stale link is
-- an ordinary outcome, not an error.
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
    'body', s.signed_body
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

-- Everything the deal page needs about one deal's documents, in one call.
--
-- The operator UI is the other half of the hash snapshot: document_hash is
-- copied onto each signature at send time, and unless a human can SEE that it
-- no longer matches the document's current body_hash, the mismatch is recorded
-- and never read. So body_hash and every signature's document_hash both travel,
-- and src/server/documents/issue.ts's signatureIsStale compares them.
--
-- signing_token is DELIBERATELY ABSENT. It is a bearer credential - whoever
-- holds it can sign the client's contract - and document_find_by_token is the
-- only place it is ever readable. An operator listing does not need it, and a
-- token that reaches a browser, a log, or a screenshot is a token that has
-- left the building.
--
-- Returns '[]' rather than null for a deal with no documents, so the caller
-- never has to distinguish "none" from "not answered".
create or replace function public.document_list_for_deal(p_deal_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'doc_type', d.doc_type,
        'title', d.title,
        'body', d.body,
        'body_hash', d.body_hash,
        'status', d.status,
        'created_at', d.created_at,
        'updated_at', d.updated_at,
        'signatures', coalesce(s.rows, '[]'::jsonb)
      )
      order by d.created_at desc
    ),
    '[]'::jsonb
  )
  from documents d
  left join lateral (
    select jsonb_agg(
             jsonb_build_object(
               'id', sg.id,
               'recipient_name', sg.recipient_name,
               'recipient_email', sg.recipient_email,
               'status', sg.status,
               'sent_at', sg.sent_at,
               'expires_at', sg.expires_at,
               'viewed_at', sg.viewed_at,
               'signed_at', sg.signed_at,
               'signed_name', sg.signed_name,
               'document_hash', sg.document_hash
             )
             order by sg.sent_at desc
           ) as rows
    from document_signatures sg
    where sg.document_id = d.id
  ) s on true
  where d.deal_id = p_deal_id;
$$;

revoke all on function public.document_list_for_deal(uuid) from public;
grant execute on function public.document_list_for_deal(uuid) to service_role;

-- Stage 4's OTHER condition, and the reason it lives here rather than in the
-- gate: it is INFORMATIONAL ONLY.
--
-- The gate's wording is "Signed and paid before any code", but only the
-- signature is asserted (see deal_has_signed_sow and advanceBlockedByUnsignedSow
-- in src/lib/crm-guards.ts). Payment depends on Stripe reconciliation, and a
-- webhook that arrives late, retries, or drops would block work that is
-- genuinely signed and genuinely paid. crm-guards.ts says payment "is surfaced
-- in the UI as an unmet condition a human can read and act on"; this function is
-- what lets that sentence be true. NOTHING may call it to refuse an advance.
--
-- Two routes from an invoice to a deal, because both exist in the schema and
-- either one is evidence: convert_won_deal stamps invoices.source_deal_id
-- directly, and projects.deal_id links the project the invoice was raised
-- against. Synthetic rows are excluded for the same reason deal_has_signed_sow
-- excludes them - fixture money is not payment.
create or replace function public.deal_deposit_paid(p_deal_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from invoices i
    left join projects p on p.id = i.project_id
    where i.paid_at is not null
      and not coalesce(i.synthetic, false)
      and (i.source_deal_id = p_deal_id or p.deal_id = p_deal_id)
  );
$$;

revoke all on function public.deal_deposit_paid(uuid) from public;
grant execute on function public.deal_deposit_paid(uuid) to service_role;
