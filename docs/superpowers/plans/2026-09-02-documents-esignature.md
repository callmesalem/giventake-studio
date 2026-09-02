# Documents & E-Signature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a deal produce a filled SOW, send it for signature, receive a legally-evidenced signature back, and block stage 4 until it has one.

**Architecture:** Two tables (`documents`, `document_signatures`) where the rendered markdown *is* the artifact. A pure template engine fails closed on unfilled placeholders and attorney-review markers. A public `sign/$token` route follows the existing unsubscribe discipline — GET renders, POST signs. The document hash is snapshotted onto the signature row at send time so later edits cannot rewrite what was signed.

**Tech Stack:** TypeScript, TanStack Start on Cloudflare Workers, Supabase (Postgres + definer RPCs), WebCrypto (not `node:crypto` — Workers), `node --experimental-strip-types` for tests.

**Spec:** `docs/superpowers/specs/2026-09-02-documents-esignature-design.md`

---

## Conventions you must follow

Read these before Task 1. They are not negotiable and they are not obvious.

- **WebCrypto only.** This deploys to Cloudflare Workers. `node:crypto` is unavailable. See `src/server/campaigns/tokens.ts` for the existing pattern.
- **Shared modules must import cleanly under `node --experimental-strip-types`.** No Deno globals, no `https://` imports. That is why `src/server/campaigns/*.ts` is testable and the edge functions are not.
- **Tests are `node:test` + `node:assert/strict`,** importing `.ts` directly. See `tests/campaign-tokens.test.mjs`.
- **Run the suite with bash, not `npm test`** — the script is a POSIX `for` loop and cmd.exe rejects it:
  `for t in tests/*.test.mjs; do node --experimental-strip-types "$t" || break; done`
- **Every table gets `synthetic boolean` and `owner_id`.** Existing rows are excluded from real counts by `synthetic = false`.
- **Migrations are idempotent:** `create table if not exists`, `add column if not exists`, `create or replace function`.
- If `git checkout` complains that `src/routeTree.gen.ts` is modified when it isn't, run `git checkout -- src/routeTree.gen.ts`. See §8 of `docs/handoff/2026-09-01-crm-state.md`.

## File structure

| File | Responsibility |
|---|---|
| `src/server/documents/hash.ts` | sha-256 hex of a string. Nothing else |
| `src/server/documents/templates.ts` | Pure merge-fill + the two fail-closed refusals. No I/O |
| `src/server/documents/signing.ts` | Pure guards: expiry, replay, consent, name |
| `src/server/documents/types.ts` | Shared types for documents and signatures |
| `src/server/documents/store.ts` | Supabase adapter — the only file that talks to the database |
| `src/server/documents/issue.ts` | Create a document and snapshot its hash onto a signature request |
| `src/server/documents/sign-flow.ts` | View and sign decisions, injectable store and clock. **Where "viewing never signs" is proven** |
| `src/server/documents/mailer.ts` | Transactional send of a signature request |
| `src/routes/sign.$token.tsx` | Public signing page. A thin wrapper over `sign-flow.ts` |
| `supabase/migrations/20260902120000_documents_esignature.sql` | Both tables, the gate function |
| `src/lib/intake.ts` (modify) | Export `sendMail`, which is currently private |
| `src/server/crm/actions.ts` (modify) | The stage-4 gate; update the `advanceDealStage` comment |
| `src/routes/crm.deals.$id.tsx` (modify) | Documents section on the deal |

**Why the logic sits beside the route rather than inside it.** `sign-flow.ts` and
`issue.ts` exist so the two claims this feature rests on — viewing never signs,
and the hash is copied at send time — are provable by a unit test rather than
asserted in a comment. That is the same reasoning that put the Sami auth decision
in `_shared/channel-auth.ts` instead of the edge function.

Pure logic first (Tasks 1–3), then schema (4–5), then the testable decision layer
(6, 8, 10), then I/O and wiring (7, 9, 11–12), then UI (13), then verification (14).
Each task ends green and committed.

---

### Task 1: Hash helper

**Files:**
- Create: `src/server/documents/hash.ts`
- Test: `tests/documents-hash.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { sha256Hex } from "../src/server/documents/hash.ts";

test("hashes a known string to its known sha-256", async () => {
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("the same input always hashes the same", async () => {
  assert.equal(await sha256Hex("Statement of Work"), await sha256Hex("Statement of Work"));
});

test("a one-character change changes the hash", async () => {
  assert.notEqual(await sha256Hex("fee: $5,000"), await sha256Hex("fee: $6,000"));
});

test("hashes empty string without throwing", async () => {
  assert.equal((await sha256Hex("")).length, 64);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types tests/documents-hash.test.mjs`
Expected: FAIL — cannot find module `hash.ts`.

- [ ] **Step 3: Implement**

```typescript
/**
 * sha-256 of a string, lowercase hex.
 *
 * WebCrypto rather than node:crypto — this runs on Cloudflare Workers, same
 * constraint as src/server/campaigns/tokens.ts.
 *
 * This is the evidentiary anchor for a signature: the hash of the exact bytes a
 * signer was shown. Keep it boring and keep it here alone.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --experimental-strip-types tests/documents-hash.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/documents/hash.ts tests/documents-hash.test.mjs
git commit -m "feat(documents): sha-256 helper for the signature evidence chain"
```

---

### Task 2: Template merge-fill

**Files:**
- Create: `src/server/documents/templates.ts`
- Test: `tests/documents-templates.test.mjs`

The existing templates use `[BRACKETED]` placeholders — `[CLIENT LEGAL NAME]`, `[PROJECT NAME]`, `[AMOUNT]`, `[DATE]`. Keys are the placeholder text without brackets.

- [ ] **Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { fillTemplate, findUnfilled } from "../src/server/documents/templates.ts";

test("fills a placeholder from the data", () => {
  assert.equal(fillTemplate("Client: [CLIENT LEGAL NAME]", { "CLIENT LEGAL NAME": "Acme LLC" }), "Client: Acme LLC");
});

test("fills every occurrence, not just the first", () => {
  assert.equal(fillTemplate("[NAME] and [NAME]", { NAME: "Ada" }), "Ada and Ada");
});

test("leaves a placeholder alone when no data is supplied", () => {
  assert.equal(fillTemplate("Fee: [AMOUNT]", {}), "Fee: [AMOUNT]");
});

test("findUnfilled lists what is still missing", () => {
  assert.deepEqual(findUnfilled("[A NAME] owes [AMOUNT]"), ["A NAME", "AMOUNT"]);
});

test("findUnfilled returns nothing for a fully filled body", () => {
  assert.deepEqual(findUnfilled("all done"), []);
});

test("findUnfilled does not report ordinary bracketed prose", () => {
  assert.deepEqual(findUnfilled("see clause [4] and [see below]"), []);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types tests/documents-templates.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
/**
 * Merge-fill for the [BRACKETED] convention used across docs/contracts and
 * docs/templates. Pure: no I/O, no database, no clock.
 *
 * A placeholder is SHOUTED — [CLIENT LEGAL NAME], [AMOUNT]. That deliberately
 * excludes ordinary prose like "[see below]" and cross-references like "[4]",
 * which appear in the contract text and must not be mistaken for merge fields.
 */
const PLACEHOLDER = /\[([A-Z][A-Z0-9 _-]*)\]/g;

export type MergeData = Record<string, string>;

export function fillTemplate(body: string, data: MergeData): string {
  return body.replace(PLACEHOLDER, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(data, key) ? data[key] : whole,
  );
}

/** Placeholders still present, in order of appearance, deduplicated. */
export function findUnfilled(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(PLACEHOLDER)) found.add(m[1]);
  return [...found];
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --experimental-strip-types tests/documents-templates.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/documents/templates.ts tests/documents-templates.test.mjs
git commit -m "feat(documents): merge-fill for the bracketed template convention"
```

---

### Task 3: The two fail-closed refusals

This is the task that keeps the un-reviewed MSA off a client's screen. `[REVIEW]` is an attorney-review flag, never a merge field.

**Files:**
- Modify: `src/server/documents/templates.ts`
- Test: `tests/documents-templates.test.mjs` (append)

- [ ] **Step 1: Write the failing test (append to the existing file)**

```javascript
import { finalizeDocument } from "../src/server/documents/templates.ts";

test("finalize returns the filled body when everything resolves", () => {
  const r = finalizeDocument("Client: [CLIENT LEGAL NAME]", { "CLIENT LEGAL NAME": "Acme LLC" });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.body, "Client: Acme LLC");
});

test("finalize REFUSES a body still carrying [REVIEW]", () => {
  const r = finalizeDocument("Indemnity [REVIEW] applies.", {});
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unresolved-review");
});

test("[REVIEW] is refused even if someone supplies data for it", () => {
  const r = finalizeDocument("Indemnity [REVIEW] applies.", { REVIEW: "fine" });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unresolved-review");
});

test("finalize REFUSES an unfilled placeholder and names it", () => {
  const r = finalizeDocument("Fee: [AMOUNT]", {});
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unfilled-placeholders");
  assert.deepEqual(r.ok === false && r.placeholders, ["AMOUNT"]);
});

test("review is reported before unfilled placeholders", () => {
  const r = finalizeDocument("[REVIEW] and [AMOUNT]", {});
  assert.equal(r.ok === false && r.reason, "unresolved-review");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types tests/documents-templates.test.mjs`
Expected: FAIL — `finalizeDocument` is not exported.

- [ ] **Step 3: Implement (append to `templates.ts`)**

```typescript
/** Attorney-review flag. Never a merge field, never fillable. */
const REVIEW_MARKER = "[REVIEW]";

export type FinalizeResult =
  | { ok: true; body: string }
  | { ok: false; reason: "unresolved-review" }
  | { ok: false; reason: "unfilled-placeholders"; placeholders: string[] };

/**
 * Fill a template and refuse to produce anything a client should not see.
 *
 * Two refusals, both fail-closed:
 *
 * 1. [REVIEW] survives filling and blocks finalisation. docs/contracts/msa-template.md
 *    opens "DRAFT - NOT FOR USE WITHOUT ATTORNEY REVIEW" and marks specific
 *    clauses [REVIEW]. This is what stops that file reaching a client, without a
 *    separate mechanism that someone has to remember to maintain.
 * 2. Any placeholder left unfilled blocks the send and is named in the error. A
 *    contract that reaches a client still saying [CLIENT LEGAL NAME] is worse
 *    than no contract.
 *
 * Order matters: review is checked first, because "your document is unfinished"
 * is the wrong message when the real problem is that a lawyer has not seen it.
 */
export function finalizeDocument(body: string, data: MergeData): FinalizeResult {
  // Checked on the RAW template, before filling, and deliberately so.
  //
  // [REVIEW] matches the placeholder pattern, so checking the FILLED body would
  // let a caller passing data.REVIEW substitute the marker away and defeat the
  // guard. The marker is a property of the template, not of the output, and no
  // caller-supplied data may make an un-reviewed contract sendable.
  if (body.includes(REVIEW_MARKER)) return { ok: false, reason: "unresolved-review" };

  const filled = fillTemplate(body, data);

  const placeholders = findUnfilled(filled);
  if (placeholders.length > 0) return { ok: false, reason: "unfilled-placeholders", placeholders };

  return { ok: true, body: filled };
}
```

**Verified against the real template before this plan was written:** `findUnfilled`
on `docs/contracts/msa-template.md` returns 9 placeholders and `REVIEW` is one of
them. That is exactly why the check must run on the raw body — the marker sits in
the same namespace as the merge fields.

- [ ] **Step 4: Run it and watch it pass**

Run: `node --experimental-strip-types tests/documents-templates.test.mjs`
Expected: PASS, 11 tests.

- [ ] **Step 5: Prove it against the real MSA**

```bash
node --experimental-strip-types -e "
import('./src/server/documents/templates.ts').then(async (m) => {
  const fs = await import('node:fs/promises');
  const msa = await fs.readFile('docs/contracts/msa-template.md', 'utf8');
  const r = m.finalizeDocument(msa, {});
  console.log('MSA refused:', r.ok === false, r.ok === false ? r.reason : '');
});
"
```

Expected: `MSA refused: true unresolved-review`. If it prints `ok: true`, stop — the guard is not working and the plan's central safety claim is false.

- [ ] **Step 6: Commit**

```bash
git add src/server/documents/templates.ts tests/documents-templates.test.mjs
git commit -m "feat(documents): fail closed on attorney-review markers and unfilled placeholders"
```

---

### Task 4: Schema

**Files:**
- Create: `supabase/migrations/20260902120000_documents_esignature.sql`
- Test: `tests/documents-migration.test.mjs`

The migration test asserts the SQL text contains required clauses, matching `tests/campaign-migration.test.mjs`. It does not need a database.

- [ ] **Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260902120000_documents_esignature.sql", "utf8");

test("both tables are created idempotently", () => {
  assert.match(sql, /create table if not exists public\.documents/);
  assert.match(sql, /create table if not exists public\.document_signatures/);
});

test("a document must belong to a deal or a project", () => {
  assert.match(sql, /check \(\s*deal_id is not null or project_id is not null\s*\)/);
});

test("stage_number is nullable because the MSA is not stage-specific", () => {
  assert.doesNotMatch(sql, /stage_number\s+integer\s+not null/);
});

test("the signature row carries its own copy of the hash", () => {
  assert.match(sql, /document_hash\s+text\s+not null/);
});

test("the signing token is unique and indexed", () => {
  assert.match(sql, /create unique index if not exists document_signatures_token_uidx/);
});

test("signatures expire", () => {
  assert.match(sql, /expires_at/);
});

test("the gate function exists", () => {
  assert.match(sql, /create or replace function public\.deal_has_signed_sow/);
});

test("tables carry the repo's synthetic convention", () => {
  assert.match(sql, /synthetic boolean/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types tests/documents-migration.test.mjs`
Expected: FAIL — ENOENT, the migration does not exist.

- [ ] **Step 3: Write the migration**

```sql
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
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --experimental-strip-types tests/documents-migration.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260902120000_documents_esignature.sql tests/documents-migration.test.mjs
git commit -m "feat(documents): schema for documents and signatures"
```

**Do not apply this migration yet.** Migrations here are applied manually and deliberately — see §3 and §6 of `docs/handoff/2026-09-01-crm-state.md`.

---

### Task 5: Types

**Files:**
- Create: `src/server/documents/types.ts`

- [ ] **Step 1: Write the file** (no test — types only, verified by `tsc` in Task 12)

```typescript
export type DocType =
  | "sow"
  | "msa"
  | "discovery_notes"
  | "weekly_update"
  | "delivery_review"
  | "handoff"
  | "acceptance";

export type DocumentStatus = "draft" | "final" | "superseded";

export type SignatureStatus = "pending" | "viewed" | "signed" | "declined" | "expired";

export interface DocumentRow {
  id: string;
  dealId: string | null;
  projectId: string | null;
  stageNumber: number | null;
  docType: DocType;
  title: string;
  body: string;
  bodyHash: string;
  templateId: string | null;
  status: DocumentStatus;
}

export interface SignatureRow {
  id: string;
  documentId: string;
  recipientName: string;
  recipientEmail: string;
  signingToken: string;
  status: SignatureStatus;
  expiresAt: string;
  signedAt: string | null;
  signedName: string | null;
  documentHash: string;
}

/** What the public sign page needs. Deliberately excludes the token. */
export interface SigningView {
  title: string;
  body: string;
  recipientName: string;
  status: SignatureStatus;
  expired: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/documents/types.ts
git commit -m "feat(documents): shared types"
```

---

### Task 6: Signing decision logic

The rules about whether a signature may proceed are pure, so they get tested without a database. This is the security core.

**Files:**
- Create: `src/server/documents/signing.ts`
- Test: `tests/documents-signing.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { canSign, validateSignatureInput } from "../src/server/documents/signing.ts";

const base = { status: "pending", expiresAt: "2999-01-01T00:00:00Z" };
const now = new Date("2026-09-02T00:00:00Z");

test("a pending, unexpired request may be signed", () => {
  assert.equal(canSign(base, now).ok, true);
});

test("an expired request may not be signed", () => {
  const r = canSign({ status: "pending", expiresAt: "2026-09-01T00:00:00Z" }, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "expired");
});

test("an already-signed request may not be signed twice", () => {
  const r = canSign({ ...base, status: "signed" }, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "already-signed");
});

test("a declined request may not be signed", () => {
  const r = canSign({ ...base, status: "declined" }, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "declined");
});

test("a viewed request may still be signed", () => {
  assert.equal(canSign({ ...base, status: "viewed" }, now).ok, true);
});

test("signing requires consent", () => {
  const r = validateSignatureInput({ typedName: "Ada Lovelace", consent: false });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "no-consent");
});

test("signing requires a non-empty typed name", () => {
  const r = validateSignatureInput({ typedName: "   ", consent: true });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "no-name");
});

test("a valid input is accepted and the name is trimmed", () => {
  const r = validateSignatureInput({ typedName: "  Ada Lovelace  ", consent: true });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.typedName, "Ada Lovelace");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types tests/documents-signing.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
/**
 * Whether a signature may proceed, and whether the submitted input constitutes
 * a signature. Pure and clock-injected so both are testable without a database.
 */
export type SignGuard =
  | { ok: true }
  | { ok: false; reason: "expired" | "already-signed" | "declined" };

export function canSign(
  request: { status: string; expiresAt: string },
  now: Date,
): SignGuard {
  if (request.status === "signed") return { ok: false, reason: "already-signed" };
  if (request.status === "declined") return { ok: false, reason: "declined" };
  if (new Date(request.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

export type InputGuard =
  | { ok: true; typedName: string }
  | { ok: false; reason: "no-consent" | "no-name" };

/**
 * Consent is checked before the name. Under ESIGN/UETA what makes this a
 * signature is demonstrated intent to sign electronically, so an unticked box
 * is not a validation nit - it means no signature happened.
 */
export function validateSignatureInput(input: {
  typedName: string;
  consent: boolean;
}): InputGuard {
  if (!input.consent) return { ok: false, reason: "no-consent" };
  const typedName = input.typedName.trim();
  if (!typedName) return { ok: false, reason: "no-name" };
  return { ok: true, typedName };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --experimental-strip-types tests/documents-signing.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/documents/signing.ts tests/documents-signing.test.mjs
git commit -m "feat(documents): signing guards for expiry, replay and consent"
```

---

### Task 7: Store adapter

**Files:**
- Create: `src/server/documents/store.ts`

Follow the shape of `src/server/campaigns/supabase-store.ts` — a factory taking `{ url, serviceRoleKey }`, returning an object whose methods are the only database access in the feature.

- [ ] **Step 1: Write the file**

```typescript
import { createClient } from "@supabase/supabase-js";
import type { SignatureRow } from "./types.ts";

export interface DocumentStore {
  createDocument(input: {
    dealId: string | null;
    projectId: string | null;
    stageNumber: number | null;
    docType: string;
    title: string;
    body: string;
    bodyHash: string;
    templateId: string | null;
    ownerId: string | null;
  }): Promise<string>;

  /** Replace an edited draft's body and re-hash it. Used by the finalise step:
   *  the operator edits the generated draft (the SOW's pricing table cannot be
   *  merge-filled), so the stored body and its hash both change before sending. */
  updateDocumentBody(input: {
    id: string;
    body: string;
    bodyHash: string;
    status: "draft" | "final";
  }): Promise<void>;

  createSignatureRequest(input: {
    documentId: string;
    recipientName: string;
    recipientEmail: string;
    documentHash: string;
    sentBy: string | null;
  }): Promise<{ id: string; signingToken: string }>;

  findByToken(token: string): Promise<(SignatureRow & { body: string; title: string }) | null>;
  markViewed(id: string): Promise<void>;
  markSigned(input: {
    id: string;
    signedName: string;
    consentText: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<void>;
  dealHasSignedSow(dealId: string): Promise<boolean>;
}

export function createSupabaseDocumentStore(config: {
  url: string;
  serviceRoleKey: string;
}): DocumentStore {
  const db = createClient(config.url, config.serviceRoleKey);

  return {
    async updateDocumentBody(input) {
      const { error } = await db
        .from("documents")
        .update({
          body: input.body,
          body_hash: input.bodyHash,
          status: input.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw new Error(`updateDocumentBody failed: ${error.message}`);
    },

    async createDocument(input) {
      const { data, error } = await db
        .from("documents")
        .insert({
          deal_id: input.dealId,
          project_id: input.projectId,
          stage_number: input.stageNumber,
          doc_type: input.docType,
          title: input.title,
          body: input.body,
          body_hash: input.bodyHash,
          template_id: input.templateId,
          owner_id: input.ownerId,
        })
        .select("id")
        .single();
      if (error) throw new Error(`createDocument failed: ${error.message}`);
      return data.id as string;
    },

    async createSignatureRequest(input) {
      const { data, error } = await db
        .from("document_signatures")
        .insert({
          document_id: input.documentId,
          recipient_name: input.recipientName,
          recipient_email: input.recipientEmail,
          document_hash: input.documentHash,
          sent_by: input.sentBy,
        })
        .select("id, signing_token")
        .single();
      if (error) throw new Error(`createSignatureRequest failed: ${error.message}`);
      return { id: data.id as string, signingToken: data.signing_token as string };
    },

    async findByToken(token) {
      const { data, error } = await db
        .from("document_signatures")
        .select(
          "id, document_id, recipient_name, recipient_email, signing_token, status, expires_at, signed_at, signed_name, document_hash, documents(title, body)",
        )
        .eq("signing_token", token)
        .maybeSingle();
      if (error || !data) return null;
      const doc = data.documents as unknown as { title: string; body: string };
      return {
        id: data.id as string,
        documentId: data.document_id as string,
        recipientName: data.recipient_name as string,
        recipientEmail: data.recipient_email as string,
        signingToken: data.signing_token as string,
        status: data.status as SignatureRow["status"],
        expiresAt: data.expires_at as string,
        signedAt: data.signed_at as string | null,
        signedName: data.signed_name as string | null,
        documentHash: data.document_hash as string,
        title: doc.title,
        body: doc.body,
      };
    },

    async markViewed(id) {
      await db
        .from("document_signatures")
        .update({ viewed_at: new Date().toISOString(), status: "viewed" })
        .eq("id", id)
        .eq("status", "pending");
    },

    async markSigned(input) {
      const { error } = await db
        .from("document_signatures")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
          signed_name: input.signedName,
          consent_text: input.consentText,
          signature_ip: input.ip,
          signature_user_agent: input.userAgent,
        })
        .eq("id", input.id)
        .in("status", ["pending", "viewed"]);
      if (error) throw new Error(`markSigned failed: ${error.message}`);
    },

    async dealHasSignedSow(dealId) {
      const { data, error } = await db.rpc("deal_has_signed_sow", { p_deal_id: dealId });
      if (error) return false;
      return data === true;
    },
  };
}
```

Note `markSigned` filters on `status in ('pending','viewed')`, so a replayed POST cannot overwrite an existing signature — the same guard shape the campaign engine's claim uses.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `src/server/documents/`.

- [ ] **Step 3: Commit**

```bash
git add src/server/documents/store.ts
git commit -m "feat(documents): supabase store adapter"
```

---

### Task 8: Sign flow — the part worth testing

The route handlers cannot be unit-tested comfortably, so the decisions come out
of the route and into a module, exactly as `supabase/functions/_shared/channel-auth.ts`
did: *"the edge function is untestable in this repo; the auth decision inside it
is the part worth testing, and it is not testable if it can only run on the edge."*

Same reasoning here, and it is what lets us prove the central safety claim — that
viewing never signs.

**Files:**
- Create: `src/server/documents/sign-flow.ts`
- Test: `tests/documents-sign-flow.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { viewSigningRequest, performSignature } from "../src/server/documents/sign-flow.ts";

const NOW = new Date("2026-09-02T00:00:00Z");

function fakeStore(overrides = {}) {
  const calls = { markViewed: 0, markSigned: 0, signedWith: null };
  return {
    calls,
    findByToken: async () => ({
      id: "sig-1",
      documentId: "doc-1",
      recipientName: "Ada Lovelace",
      recipientEmail: "ada@example.com",
      signingToken: "tok",
      status: "pending",
      expiresAt: "2999-01-01T00:00:00Z",
      signedAt: null,
      signedName: null,
      documentHash: "abc",
      title: "SOW",
      body: "the body",
      ...overrides,
    }),
    markViewed: async () => { calls.markViewed++; },
    markSigned: async (i) => { calls.markSigned++; calls.signedWith = i; },
  };
}

test("viewing NEVER signs", async () => {
  const s = fakeStore();
  await viewSigningRequest(s, "tok", NOW);
  assert.equal(s.calls.markSigned, 0, "viewing must never call markSigned");
});

test("viewing marks the request viewed", async () => {
  const s = fakeStore();
  const r = await viewSigningRequest(s, "tok", NOW);
  assert.equal(r.ok, true);
  assert.equal(s.calls.markViewed, 1);
});

test("viewing an expired request does not mark it viewed", async () => {
  const s = fakeStore({ expiresAt: "2026-09-01T00:00:00Z" });
  const r = await viewSigningRequest(s, "tok", NOW);
  assert.equal(r.ok, false);
  assert.equal(s.calls.markViewed, 0);
});

test("an unknown token yields not-found rather than throwing", async () => {
  const s = { findByToken: async () => null, markViewed: async () => {}, markSigned: async () => {} };
  const r = await viewSigningRequest(s, "nope", NOW);
  assert.equal(r.ok, false);
});

test("signing without consent does not sign", async () => {
  const s = fakeStore();
  const r = await performSignature(s, "tok", { typedName: "Ada", consent: false }, NOW, {});
  assert.equal(r.ok, false);
  assert.equal(s.calls.markSigned, 0);
});

test("signing an expired request does not sign", async () => {
  const s = fakeStore({ expiresAt: "2026-09-01T00:00:00Z" });
  const r = await performSignature(s, "tok", { typedName: "Ada", consent: true }, NOW, {});
  assert.equal(r.ok, false);
  assert.equal(s.calls.markSigned, 0);
});

test("signing an already-signed request does not sign again", async () => {
  const s = fakeStore({ status: "signed" });
  const r = await performSignature(s, "tok", { typedName: "Ada", consent: true }, NOW, {});
  assert.equal(r.ok, false);
  assert.equal(s.calls.markSigned, 0);
});

test("a valid signature records the name, the consent text, ip and user agent", async () => {
  const s = fakeStore();
  const r = await performSignature(
    s, "tok", { typedName: "  Ada Lovelace ", consent: true }, NOW,
    { ip: "203.0.113.9", userAgent: "Mozilla/5.0" },
  );
  assert.equal(r.ok, true);
  assert.equal(s.calls.markSigned, 1);
  assert.equal(s.calls.signedWith.signedName, "Ada Lovelace");
  assert.equal(s.calls.signedWith.ip, "203.0.113.9");
  assert.equal(s.calls.signedWith.userAgent, "Mozilla/5.0");
  assert.ok(s.calls.signedWith.consentText.length > 0, "consent wording must be stored verbatim");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types tests/documents-sign-flow.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import { canSign, validateSignatureInput } from "./signing.ts";
import type { SigningView } from "./types.ts";

export const CONSENT_TEXT =
  "I intend to sign this document electronically, and I agree that my typed name " +
  "is my signature and has the same effect as a handwritten one.";

interface FlowStore {
  findByToken(token: string): Promise<
    | ({ id: string; status: string; expiresAt: string; signedAt: string | null;
         recipientName: string; title: string; body: string })
    | null
  >;
  markViewed(id: string): Promise<void>;
  markSigned(input: {
    id: string; signedName: string; consentText: string;
    ip: string | null; userAgent: string | null;
  }): Promise<void>;
}

export type ViewResult =
  | { ok: true; view: SigningView }
  | { ok: false; reason: "not-found" | "unavailable" | "already-signed"; signedAt?: string | null };

/**
 * Render-time path. Marks the request viewed and NOTHING else.
 *
 * It must never reach markSigned. Mail clients and scanners prefetch links; a
 * prefetched unsubscribe was judged unacceptable when the campaign engine
 * shipped, and a prefetched signature is categorically worse. The test above is
 * the guarantee, not this comment.
 */
export async function viewSigningRequest(
  store: FlowStore,
  token: string,
  now: Date,
): Promise<ViewResult> {
  const req = await store.findByToken(token);
  if (!req) return { ok: false, reason: "not-found" };

  const guard = canSign(req, now);
  if (!guard.ok) {
    if (guard.reason === "already-signed") {
      return { ok: false, reason: "already-signed", signedAt: req.signedAt };
    }
    return { ok: false, reason: "unavailable" };
  }

  await store.markViewed(req.id).catch(() => undefined);

  return {
    ok: true,
    view: {
      title: req.title,
      body: req.body,
      recipientName: req.recipientName,
      status: "viewed",
      expired: false,
    },
  };
}

export type SignResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "unavailable" | "invalid-input" };

export async function performSignature(
  store: FlowStore,
  token: string,
  input: { typedName: string; consent: boolean },
  now: Date,
  meta: { ip?: string | null; userAgent?: string | null },
): Promise<SignResult> {
  const req = await store.findByToken(token);
  if (!req) return { ok: false, reason: "not-found" };

  if (!canSign(req, now).ok) return { ok: false, reason: "unavailable" };

  const valid = validateSignatureInput(input);
  if (!valid.ok) return { ok: false, reason: "invalid-input" };

  await store.markSigned({
    id: req.id,
    signedName: valid.typedName,
    consentText: CONSENT_TEXT,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });

  return { ok: true };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --experimental-strip-types tests/documents-sign-flow.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/documents/sign-flow.ts tests/documents-sign-flow.test.mjs
git commit -m "feat(documents): sign flow, with a test proving viewing never signs"
```

---

### Task 9: The public signing route

A thin wrapper over Task 8. All decisions live in `sign-flow.ts`.

**Files:**
- Create: `src/routes/sign.$token.tsx`

Model on `src/routes/api.unsubscribe.$token.ts`. Read it first.

- [ ] **Step 1: Write the route**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseDocumentStore } from "@/server/documents/store.ts";
import {
  CONSENT_TEXT,
  performSignature,
  viewSigningRequest,
} from "@/server/documents/sign-flow.ts";

const PAGE = (body: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Sign document</title>${body}`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The same page for every unusable link - expired, already signed, declined, or
 * simply wrong. A distinct message per case lets someone probe which tokens are
 * real, and there is nothing a legitimate signer can do about any of them.
 */
const UNAVAILABLE = () =>
  PAGE(`<p>This signing link is no longer available. Please ask for a new one.</p>`, 404);

function store() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseDocumentStore({ url, serviceRoleKey: key });
}

export const Route = createFileRoute("/sign/$token")({
  server: {
    handlers: {
      /**
       * GET renders. It NEVER signs.
       *
       * Mail clients and security scanners prefetch links. That was judged
       * unacceptable for unsubscribe when the campaign engine shipped; a
       * prefetched signature is categorically worse. Signing requires the POST
       * below, a ticked consent box and a typed name.
       *
       * viewed_at is written here and is therefore ADVISORY - a scanner can
       * trigger it. It is a convenience for the operator, never evidence.
       */
      GET: async ({ params }) => {
        const s = store();
        if (!s) return UNAVAILABLE();

        const result = await viewSigningRequest(s, params.token, new Date());
        if (!result.ok) {
          if (result.reason === "already-signed") {
            return PAGE(
              `<p>This document was already signed on ${escape(result.signedAt ?? "")}.</p>`,
            );
          }
          return UNAVAILABLE();
        }
        const { view } = result;

        return PAGE(
          `<h1>${escape(view.title)}</h1>` +
            `<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escape(view.body)}</pre>` +
            `<form method="post" action="/sign/${encodeURIComponent(params.token)}">` +
            `<p><label><input type="checkbox" name="consent" value="yes" required> ${escape(CONSENT_TEXT)}</label></p>` +
            `<p><label>Type your full legal name<br><input name="typedName" required autocomplete="name"></label></p>` +
            `<button type="submit">Sign</button></form>`,
        );
      },

      /** POST performs the signature. */
      POST: async ({ params, request }) => {
        const s = store();
        if (!s) return UNAVAILABLE();

        const form = await request.formData();
        const result = await performSignature(
          s,
          params.token,
          {
            typedName: String(form.get("typedName") ?? ""),
            consent: form.get("consent") === "yes",
          },
          new Date(),
          {
            ip: request.headers.get("cf-connecting-ip"),
            userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
          },
        );

        if (!result.ok) {
          if (result.reason === "invalid-input") {
            return PAGE(
              `<p>Tick the consent box and type your full legal name to sign.</p>` +
                `<p><a href="/sign/${encodeURIComponent(params.token)}">Back</a></p>`,
              400,
            );
          }
          return UNAVAILABLE();
        }

        return PAGE(`<h1>Signed</h1><p>Thank you. A copy has been recorded.</p>`);
      },
    },
  },
});
```

Note the IP is read from `cf-connecting-ip`, not the first `x-forwarded-for` entry — see `supabase/functions/_shared/channel-auth.ts` for why the leftmost XFF entry is caller-controlled.

- [ ] **Step 2: Build to regenerate the route tree**

Run: `npx vite build`
Expected: build succeeds and `src/routeTree.gen.ts` now contains `/sign/$token`.

- [ ] **Step 3: Commit — including the regenerated route tree**

```bash
git add src/routes/sign.\$token.tsx src/routeTree.gen.ts
git commit -m "feat(documents): public signing page, GET renders and POST signs"
```

CI fails if `routeTree.gen.ts` is stale. It must be committed with the route.

---

### Task 10: Document creation and the hash snapshot

This is the evidence chain. The spec's central claim — that editing a document
after sending cannot rewrite what was signed — is only true if the hash is
copied onto the signature row at send time. That copy gets its own task and its
own test, because a `document_hash` column that is never written is worse than
no column: it looks like evidence.

ClaimNimbus declares that column and was not observed writing it. Do not repeat
that here.

**Files:**
- Create: `src/server/documents/issue.ts`
- Test: `tests/documents-issue.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { draftDocument, finaliseDraft, requestSignature, signatureIsStale } from "../src/server/documents/issue.ts";

function fakeStore() {
  const state = { docs: [], sigs: [], updates: [] };
  return {
    state,
    createDocument: async (d) => { state.docs.push(d); return `doc-${state.docs.length}`; },
    updateDocumentBody: async (u) => { state.updates.push(u); },
    createSignatureRequest: async (r) => {
      state.sigs.push(r);
      return { id: `sig-${state.sigs.length}`, signingToken: `tok-${state.sigs.length}` };
    },
  };
}

const DEAL = { dealId: "deal-1", projectId: null, stageNumber: 3, docType: "sow",
               title: "SOW", templateId: "sow", ownerId: null };

test("drafting ALLOWS unfilled placeholders — the operator fills them by editing", async () => {
  const s = fakeStore();
  const r = await draftDocument(s, { ...DEAL, templateBody: "Fee: $[X] for [PROJECT NAME]", data: { "PROJECT NAME": "Portal" } });
  assert.equal(r.ok, true);
  assert.equal(s.state.docs[0].body, "Fee: $[X] for Portal");
  assert.equal(s.state.docs[0].status, "draft");
});

test("drafting still REFUSES a template carrying [REVIEW]", async () => {
  const s = fakeStore();
  const r = await draftDocument(s, { ...DEAL, templateBody: "Indemnity [REVIEW].", data: {} });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unresolved-review");
  assert.equal(s.state.docs.length, 0, "nothing may be stored when the review guard refuses");
});

test("drafting stores the filled body and its hash", async () => {
  const s = fakeStore();
  const r = await draftDocument(s, {
    ...DEAL, templateBody: "Client: [CLIENT LEGAL NAME]", data: { "CLIENT LEGAL NAME": "Acme LLC" },
  });
  assert.equal(r.ok, true);
  assert.equal(s.state.docs[0].bodyHash.length, 64);
  assert.equal(r.ok && r.bodyHash, s.state.docs[0].bodyHash);
});

test("finalising REFUSES an edited body with placeholders still in it", async () => {
  const s = fakeStore();
  const r = await finaliseDraft(s, { documentId: "doc-1", body: "Fee: $[X]" });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unfilled-placeholders");
  assert.deepEqual(r.ok === false && r.placeholders, ["X"]);
  assert.equal(s.state.updates.length, 0, "a refused finalise must not write");
});

test("finalising REFUSES an edited body someone pasted [REVIEW] into", async () => {
  const s = fakeStore();
  const r = await finaliseDraft(s, { documentId: "doc-1", body: "Indemnity [REVIEW]." });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unresolved-review");
});

test("finalising a complete body re-hashes it and marks it final", async () => {
  const s = fakeStore();
  const r = await finaliseDraft(s, { documentId: "doc-1", body: "Fee: $4,250" });
  assert.equal(r.ok, true);
  assert.equal(s.state.updates[0].status, "final");
  assert.equal(s.state.updates[0].body, "Fee: $4,250");
  assert.equal(s.state.updates[0].bodyHash.length, 64);
  assert.equal(r.ok && r.bodyHash, s.state.updates[0].bodyHash);
});

test("editing changes the hash, which is what makes a stale signature detectable", async () => {
  const s = fakeStore();
  const a = await finaliseDraft(s, { documentId: "doc-1", body: "Fee: $4,250" });
  const b = await finaliseDraft(s, { documentId: "doc-1", body: "Fee: $6,000" });
  assert.notEqual(a.ok && a.bodyHash, b.ok && b.bodyHash);
});

test("requesting a signature COPIES the document hash onto the signature row", async () => {
  const s = fakeStore();
  const doc = await finaliseDraft(s, { documentId: "doc-1", body: "Complete body" });
  assert.equal(doc.ok, true);
  await requestSignature(s, {
    documentId: "doc-1",
    bodyHash: doc.ok ? doc.bodyHash : "",
    recipientName: "Ada", recipientEmail: "ada@example.com", sentBy: null,
  });
  assert.equal(s.state.sigs[0].documentHash, doc.ok && doc.bodyHash);
});

test("a signature is not stale when the hashes match", () => {
  assert.equal(signatureIsStale({ bodyHash: "aaa" }, { documentHash: "aaa" }), false);
});

test("editing the document after sending makes the signature detectably stale", () => {
  assert.equal(signatureIsStale({ bodyHash: "bbb" }, { documentHash: "aaa" }), true);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types tests/documents-issue.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import { fillTemplate, finalizeDocument, type MergeData } from "./templates.ts";
import { sha256Hex } from "./hash.ts";

interface IssueStore {
  createDocument(input: {
    dealId: string | null; projectId: string | null; stageNumber: number | null;
    docType: string; title: string; body: string; bodyHash: string;
    templateId: string | null; ownerId: string | null;
  }): Promise<string>;
  updateDocumentBody(input: {
    id: string; body: string; bodyHash: string; status: "draft" | "final";
  }): Promise<void>;
  createSignatureRequest(input: {
    documentId: string; recipientName: string; recipientEmail: string;
    documentHash: string; sentBy: string | null;
  }): Promise<{ id: string; signingToken: string }>;
}

export type DraftResult =
  | { ok: true; documentId: string; bodyHash: string; body: string }
  | { ok: false; reason: "unresolved-review" };

export type FinaliseResult =
  | { ok: true; bodyHash: string }
  | { ok: false; reason: "unresolved-review" }
  | { ok: false; reason: "unfilled-placeholders"; placeholders: string[] };

/**
 * Generate a DRAFT. Unfilled placeholders are allowed here, deliberately.
 *
 * The SOW's pricing table is a repeating row - `| [description] | $[X] | ... |`
 * once per line item - and a merge field cannot express a variable-length table.
 * A single [X] would put the same price on every line. So generation fills what
 * the deal knows, and the operator edits the rest before finalising. [MSA DATE]
 * works the same way: the MSA is signed outside this system, so its date is
 * typed in rather than derived.
 *
 * The [REVIEW] guard still applies at draft time. There is no legitimate reason
 * to draft from an un-reviewed template, and allowing it would mean the only
 * thing standing between msa-template.md and a client is remembering not to
 * press finalise.
 */
export async function draftDocument(
  store: IssueStore,
  input: {
    templateBody: string; data: MergeData;
    dealId: string | null; projectId: string | null; stageNumber: number | null;
    docType: string; title: string; templateId: string | null; ownerId: string | null;
  },
): Promise<DraftResult> {
  if (input.templateBody.includes("[REVIEW]")) {
    return { ok: false, reason: "unresolved-review" };
  }

  const body = fillTemplate(input.templateBody, input.data);
  const bodyHash = await sha256Hex(body);

  const documentId = await store.createDocument({
    dealId: input.dealId,
    projectId: input.projectId,
    stageNumber: input.stageNumber,
    docType: input.docType,
    title: input.title,
    body,
    bodyHash,
    templateId: input.templateId,
    ownerId: input.ownerId,
  });

  return { ok: true, documentId, bodyHash, body };
}

/**
 * Finalise an edited draft. THIS is where the refusals bite.
 *
 * finalizeDocument is called with no merge data, so it validates rather than
 * fills: it refuses [REVIEW] and refuses any placeholder the operator left
 * behind. Nothing is written when it refuses - a document marked final that
 * still says [CLIENT LEGAL NAME] is exactly the failure this feature exists to
 * prevent.
 *
 * The body is re-hashed here. That hash is what a signature request will copy,
 * so editing after sending changes documents.body_hash and leaves the
 * signature's copy behind - which is how a stale signature stays detectable.
 */
export async function finaliseDraft(
  store: IssueStore,
  input: { documentId: string; body: string },
): Promise<FinaliseResult> {
  const checked = finalizeDocument(input.body, {});
  if (!checked.ok) return checked;

  const bodyHash = await sha256Hex(checked.body);

  await store.updateDocumentBody({
    id: input.documentId,
    body: checked.body,
    bodyHash,
    status: "final",
  });

  return { ok: true, bodyHash };
}

/**
 * Create the signature request, copying the document's hash onto it.
 *
 * The copy is the point. documents.body_hash tracks the document as it is now;
 * document_signatures.document_hash records what the signer was shown. Editing
 * the document afterwards changes the first and not the second, which is what
 * makes a stale signature detectable instead of silent.
 */
export async function requestSignature(
  store: IssueStore,
  input: {
    documentId: string; bodyHash: string;
    recipientName: string; recipientEmail: string; sentBy: string | null;
  },
): Promise<{ id: string; signingToken: string }> {
  return store.createSignatureRequest({
    documentId: input.documentId,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    documentHash: input.bodyHash,
    sentBy: input.sentBy,
  });
}

/** True when the document has changed since this signature was requested. */
export function signatureIsStale(
  document: { bodyHash: string },
  signature: { documentHash: string },
): boolean {
  return document.bodyHash !== signature.documentHash;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --experimental-strip-types tests/documents-issue.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

Stage `src/server/documents/issue.ts` and `tests/documents-issue.test.mjs`, with the message:
`feat(documents): issue documents and snapshot the hash onto the signature`

---

### Task 11: Transactional send

`sendMail` in `src/lib/intake.ts` is **not exported** — only `submitContact` and `submitDsar` are. Export it rather than duplicating the Resend call.

**Files:**
- Modify: `src/lib/intake.ts`
- Create: `src/server/documents/mailer.ts`

- [ ] **Step 1: Export `sendMail`**

In `src/lib/intake.ts`, change `async function sendMail(` to `export async function sendMail(` and add above it:

```typescript
/** Exported for the documents feature. A signature request is transactional
 *  mail to someone already in a commercial conversation, so it goes here and
 *  NOT through the campaign mailer: approved_recipients is the per-SOP outbound
 *  allowlist (charter §3.8), and gating a contract on it would both break
 *  legitimate sends and misuse a consent mechanism built for something else. */
```

- [ ] **Step 2: Write the mailer**

```typescript
import { sendMail } from "@/lib/intake.ts";

export async function sendSignatureRequest(input: {
  to: string;
  recipientName: string;
  documentTitle: string;
  signUrl: string;
  replyTo: string;
}): Promise<{ sent: boolean }> {
  const text =
    `Hello ${input.recipientName},\n\n` +
    `Please review and sign: ${input.documentTitle}\n\n` +
    `${input.signUrl}\n\n` +
    `This link expires in 7 days.\n`;

  const result = await sendMail(input.to, `Please sign: ${input.documentTitle}`, text, input.replyTo);
  return { sent: result.status === "sent" };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/intake.ts src/server/documents/mailer.ts
git commit -m "feat(documents): send signature requests on the transactional path"
```

---

### Task 12: Stage 4 gate

**Files:**
- Modify: `src/server/crm/actions.ts`
- Test: `tests/documents-gate.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { stageAdvanceBlocked } from "../src/server/crm/actions.ts";

test("stage 4 is blocked without a signed SOW", () => {
  assert.equal(stageAdvanceBlocked("4", false), true);
});

test("stage 4 is allowed with a signed SOW", () => {
  assert.equal(stageAdvanceBlocked("4", true), false);
});

test("other stages are never blocked by this gate", () => {
  assert.equal(stageAdvanceBlocked("3", false), false);
  assert.equal(stageAdvanceBlocked("7", false), false);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types tests/documents-gate.test.mjs`
Expected: FAIL — `stageAdvanceBlocked` is not exported.

- [ ] **Step 3: Implement in `src/server/crm/actions.ts`**

Add near the top-level exports:

```typescript
/**
 * Stage 4 is the one gate a function can witness.
 *
 * advanceDealStage deliberately does not assert gates, because most of them -
 * "Problem understood, quantified", "Client saw it working each week" - are
 * human judgements. Stage 4's gate, "Signed and paid before any code", is a
 * fact with a record, and the documents feature is that record. This is an
 * exception to that rule, not a repeal of it.
 *
 * Payment is deliberately NOT part of this: invoices.paid_at depends on Stripe
 * reconciliation, and a webhook hiccup must not block work that is genuinely
 * signed. It is surfaced on the deal as an unmet condition instead.
 */
export function stageAdvanceBlocked(toStage: string, hasSignedSow: boolean): boolean {
  return toStage === "4" && !hasSignedSow;
}
```

Then update the `advanceDealStage` doc comment from:

```
/** Advance a deal. The RPC stamps the actor and requires a note; it does NOT
 *  assert the stage gate was satisfied, because that is a human judgement and
 *  a function cannot witness it. */
```

to:

```
/** Advance a deal. The RPC stamps the actor and requires a note. It does NOT
 *  assert most stage gates, because they are human judgements a function cannot
 *  witness. Stage 4 is the exception: see stageAdvanceBlocked above - a
 *  signature is a fact with a record, and since 2026-09-02 there is one. */
```

- [ ] **Step 4: Enforce it in the caller**

In `advanceDealStage`, before the `#rpc` call:

```typescript
if (input.toStage === "4") {
  const signed = await this.#rpc<boolean>("deal_has_signed_sow", { p_deal_id: input.dealId });
  if (stageAdvanceBlocked(input.toStage, signed === true)) {
    throw new Error("Stage 4 requires a signed SOW. Send the SOW for signature first.");
  }
}
```

Change the method signature to `async advanceDealStage(...)` if it is not already async.

- [ ] **Step 5: Run tests**

Run: `node --experimental-strip-types tests/documents-gate.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/server/crm/actions.ts tests/documents-gate.test.mjs
git commit -m "feat(documents): stage 4 requires a signed SOW"
```

---

### Task 13: Deal detail UI

**Files:**
- Modify: `src/routes/crm.deals.$id.tsx`

Read the file first and follow its existing card/section pattern and the components in `src/components/crm/ui.tsx`. Do not introduce a new design system.

- [ ] **Step 1: Create the server functions**

Create `src/server/documents/deal-actions.ts`. Model the `createServerFn` usage on
`submitContact` in `src/lib/intake.ts`.

```typescript
import { createServerFn } from "@tanstack/react-start";
import sowTemplate from "../../../docs/contracts/sow-template.md?raw";
import { createSupabaseDocumentStore } from "./store.ts";
import { draftDocument, finaliseDraft, requestSignature } from "./issue.ts";
import { sendSignatureRequest } from "./mailer.ts";

function store() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createSupabaseDocumentStore({ url, serviceRoleKey: key });
}

/**
 * Generate a SOW draft from the deal.
 *
 * Measured against the real docs/contracts/sow-template.md, which needs TEN
 * fields: NUMBER, MSA DATE, CLIENT LEGAL NAME, PROJECT NAME, DATE, N, AMOUNT,
 * X, RATE, NAME.
 *
 * Only some can be derived. [X] is a repeating pricing-table cell — one value
 * would price every line item identically — and [MSA DATE] refers to a Master
 * Services Agreement signed outside this system. Both are left for the operator
 * to edit, which is why this produces a DRAFT and finalising is a separate step.
 */
export const generateSowDraft = createServerFn({ method: "POST" })
  .validator((d: { dealId: string; clientLegalName: string; projectName: string }) => d)
  .handler(async ({ data }) => {
    return draftDocument(store(), {
      templateBody: sowTemplate,
      data: {
        "CLIENT LEGAL NAME": data.clientLegalName,
        "PROJECT NAME": data.projectName,
        DATE: new Date().toISOString().slice(0, 10),
      },
      dealId: data.dealId,
      projectId: null,
      stageNumber: 3,
      docType: "sow",
      title: `SOW — ${data.projectName}`,
      templateId: "sow",
      ownerId: null,
    });
  });

/** Save the operator's edits and finalise. Refuses if any placeholder remains,
 *  naming them, so the UI can say exactly what still needs filling. */
export const finaliseDocument = createServerFn({ method: "POST" })
  .validator((d: { documentId: string; body: string }) => d)
  .handler(async ({ data }) => {
    return finaliseDraft(store(), { documentId: data.documentId, body: data.body });
  });

export const sendForSignature = createServerFn({ method: "POST" })
  .validator((d: { documentId: string; bodyHash: string; recipientName: string; recipientEmail: string }) => d)
  .handler(async ({ data }) => {
    const { signingToken } = await requestSignature(store(), {
      documentId: data.documentId,
      bodyHash: data.bodyHash,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      sentBy: null,
    });

    const base = process.env.CAMPAIGN_UNSUBSCRIBE_BASE?.replace(/\/api\/unsubscribe$/, "") ?? "";
    const sent = await sendSignatureRequest({
      to: data.recipientEmail,
      recipientName: data.recipientName,
      documentTitle: "Statement of Work",
      signUrl: `${base}/sign/${signingToken}`,
      replyTo: process.env.INTAKE_TO_EMAIL ?? "",
    });

    return { sent: sent.sent };
  });
```

If `CAMPAIGN_UNSUBSCRIBE_BASE` is unset the sign URL is relative and the email is
useless. Add `SITE_BASE_URL` to `wrangler.jsonc` vars rather than deriving it, if
that reads cleaner to you — but do not leave it undefined.

- [ ] **Step 2: Add the Documents section to the deal page**

The section needs three states per document, because generation no longer
produces something sendable in one shot:

1. **draft** — render the body in an editable `<textarea>` with a Finalise
   button. Placeholders the operator must still fill (the pricing table, the MSA
   date) are visible in the text. On a refused finalise, list the named
   placeholders returned by the server so they know exactly what is missing.
2. **final** — read-only, with a Send for signature control taking recipient
   name and email.
3. **sent/signed** — the signature status, and the stale-version warning below.


Read `src/routes/crm.deals.$id.tsx` and follow its existing loader and `Card`
usage. Add a section rendering the deal's documents:

```tsx
function DocumentsSection({
  documents,
}: {
  documents: Array<{
    id: string;
    title: string;
    docType: string;
    status: string;
    bodyHash: string;
    signatures: Array<{
      status: string;
      signedName: string | null;
      signedAt: string | null;
      documentHash: string;
    }>;
  }>;
}) {
  return (
    <Card>
      <h2 className="text-sm font-semibold">Documents</h2>
      {documents.length === 0 && <p className="text-muted-foreground text-sm">None yet.</p>}
      <ul className="space-y-2">
        {documents.map((doc) => (
          <li key={doc.id} className="border-border border-b pb-2 last:border-0">
            <div className="flex items-center justify-between">
              <span>{doc.title}</span>
              <span className="text-muted-foreground text-xs">{doc.status}</span>
            </div>
            {doc.signatures.map((sig, i) => (
              <div key={i} className="text-xs">
                {sig.status === "signed" ? (
                  <span>
                    Signed by {sig.signedName} on {sig.signedAt}
                  </span>
                ) : (
                  <span>Signature {sig.status}</span>
                )}
                {sig.documentHash !== doc.bodyHash && (
                  <strong className="text-destructive block">
                    This signature is against an earlier version of the document.
                  </strong>
                )}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </Card>
  );
}
```

The stale-version warning is not decoration. It is the visible half of the hash
snapshot from Task 10 — without it, the mismatch is recorded and never seen.

- [ ] **Step 3: Show the gate near the stage control**

```tsx
<div className="text-xs">
  <div>{hasSignedSow ? "✓" : "✗"} Signed SOW {hasSignedSow ? "" : "— required for stage 4"}</div>
  <div>{depositPaid ? "✓" : "✗"} Deposit paid <span className="text-muted-foreground">(informational)</span></div>
</div>
```

`hasSignedSow` comes from the `deal_has_signed_sow` RPC; `depositPaid` from
`invoices.paid_at` for this deal. The deposit line must **not** disable the stage
control — see the reasoning in Task 12.

- [ ] **Step 3: Build**

Run: `npx vite build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/routes/crm.deals.\$id.tsx src/routeTree.gen.ts
git commit -m "feat(documents): documents and gate status on the deal page"
```

---

### Task 14: Full verification

- [ ] **Step 1: Whole suite**

```bash
for t in tests/*.test.mjs; do case "$t" in *integration*) continue;; esac; node --experimental-strip-types "$t" || break; done
```

Expected: every file passes. Before this feature the count was 32 files.

- [ ] **Step 2: Component tests**

Run: `npx vitest run --config vitest.config.ts`
Expected: PASS.

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit
npx eslint src/server/documents src/routes/sign.\$token.tsx
```

Expected: clean. Lint runs prettier as an error — if it complains, run `npx prettier --write` on the named files, which is what CI checks.

- [ ] **Step 4: Route tree is current**

```bash
npx vite build
git diff --quiet -- src/routeTree.gen.ts && echo "route tree current" || echo "STALE - commit it"
```

- [ ] **Step 5: Commit any fixes, then open the PR**

The migration is **not** applied by this plan. Applying it is a manual, deliberate step — see §3 and §6 of `docs/handoff/2026-09-01-crm-state.md`.

---

## Deploy order

1. Merge the PR
2. Apply `20260902120000_documents_esignature.sql` manually
3. Verify: `select to_regclass('public.documents'), to_regproc('public.deal_has_signed_sow');`

Until step 2, generating a document fails at the store layer. Nothing sends, so nothing reaches a client — the failure is loud and safe.
