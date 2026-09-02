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
