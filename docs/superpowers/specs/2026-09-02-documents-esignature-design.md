# Documents & E-Signature — Design

**Date:** 2026-09-02
**Status:** Approved, not yet implemented
**Scope:** Document generation, storage and in-house electronic signature

## The gap

`pipeline_stages` names an artifact for every one of the twelve stages — "Discovery
notes", "Proposal + SOW", "Signed SOW + deposit", "Written acceptance", "Handoff
package". The pipeline is already a document workflow. The CRM cannot hold a single
one of those documents.

What exists today is `src/routes/crm.documents.tsx`, which imports six markdown
files with `?raw` and renders them. It is a template *library*: read-only, identical
for every client, with no way to produce a filled instance, store it, send it, or
record that anyone agreed to it.

The cost is concrete. **Stage 4's gate reads "Signed and paid before any code."**
That gate is unenforceable and unevidenced — nothing in the database can answer
"did they sign?", so the rule the business runs on is a convention held in one
person's head.

## Governing constraints

**Charter §3.8 — `approved_recipients` is for outbound SOP campaigns.** A signature
request is transactional mail to someone already in a commercial conversation. It
must NOT route through the campaign mailer or the approved-recipient allowlist.
Sending goes through `src/lib/intake.ts`, the transactional path. Wiring a contract
send through the campaign gates would both break legitimate sends and misuse a
consent mechanism built for a different purpose.

**The MSA is not cleared for use.** `docs/contracts/msa-template.md` opens with
`DRAFT — NOT FOR USE WITHOUT ATTORNEY REVIEW`, carries `[REVIEW]` markers on
specific clauses, and warns that the studio must contract through GivenTake Devs
LLC rather than GivenTake Goods LLC, which carries a construction-defect tail under
ORC § 2305.131. A document-sending feature that can put that file in front of a
client is a liability, not a feature. The template engine below refuses it by
construction.

**Cloudflare Workers has no headless browser.** PDF rendering is not available in
the runtime this deploys to. The design does not pretend otherwise.

**No storage buckets exist.** `storage.buckets` is empty. The design keeps it that
way.

## Decisions

| Decision | Chosen | Rejected |
|---|---|---|
| Signature | Built in-house | A provider (Dropbox Sign / DocuSign). Recommended, not chosen — the evidentiary burden now sits with this code, so the design carries it deliberately |
| Provider adapter | None | A port/adapter for later swap. YAGNI until a provider is actually wanted |
| Token | Stored random token on the row | Stateless HMAC via `campaigns/tokens.ts`. A signature link needs status, expiry and revocation; a stateless token cannot be revoked |
| Signature form | Typed name + explicit consent | A drawn signature. Equivalent under ESIGN/UETA for intent and attribution, better evidence than an unauthenticated scribble, and needs no storage bucket |
| Artifact coverage | All twelve stages in one table | SOW only. `doc_type` generalises storage; signing is a separate optional layer applied only to signable types |
| Stage 4 gate | Hard-block on signature, evidence payment | Blocking on payment too — that would make advancing a deal depend on Stripe reconciliation, so a webhook hiccup stops real work |
| UI | Native to this codebase | Porting ClaimNimbus components. Its stack is a Capacitor SPA; this is TanStack Start on Workers |

## Prior art: ClaimNimbus

The sibling product has a working in-house signing system, last touched 2026-09-01.
Its `signing_requests` table already carries the shape this needs — `document_hash`,
`signature_ip_address`, `signature_user_agent`, `expires_at`, `viewed_at`,
`signed_at`, `declined_reason`. Its `src/lib/document-templates.ts` is a merge-field
engine, itself ported once already from an MCP document-drafter server.

Two things were verified in that codebase rather than assumed:

- **`handleSign` fires from an `onClick`, not a `useEffect`.** Signing requires a
  deliberate human action; a prefetched link cannot sign. This design keeps that
  property and states it explicitly rather than inheriting it by luck.
- **`document_hash` is declared but was not observed being populated** in
  `ClientSignPage.tsx` or `useSigningRequests.ts`. A hash column that is never
  written is worse than no column, because it looks like evidence. Here it is
  populated at send time and asserted by a test.

What is dropped in the port: `organization_id` (this is single-org), `claim_id`
(becomes `deal_id` / `project_id`), `signature_image_path` (no drawn signature, no
bucket), and `signing_order` (single signer; see Open questions).

## Schema

Two tables, one migration.

### `documents`

One row per artifact instance.

| Column | Notes |
|---|---|
| `id` | uuid pk |
| `deal_id`, `project_id` | nullable fks, with a check constraint requiring at least one. An artifact attached to neither belongs to nothing and cannot be found again |
| `stage_number` | **nullable.** Which stage's artifact this is — null for documents that are not stage-specific, the MSA being the obvious one |
| `doc_type` | `sow`, `msa`, `discovery_notes`, `weekly_update`, `delivery_review`, `handoff`, `acceptance`. `msa` is a valid type from day one even though the engine refuses to finalise the MSA template — the type is not what is blocked, the un-reviewed content is |
| `title` | rendered title |
| `body` | the rendered markdown. **This is the canonical artifact**, not a pointer to one |
| `body_hash` | sha-256 of `body` |
| `template_id` | which template produced it |
| `status` | `draft`, `final`, `superseded` |
| `owner_id`, `synthetic`, `created_at` | repo conventions; `synthetic` keeps test data out of real counts |

### `document_signatures`

One row per requested signature.

| Column | Notes |
|---|---|
| `document_id` | fk to `documents` |
| `recipient_name`, `recipient_email`, `recipient_role` | who is being asked |
| `signing_token` | random, unique, indexed; the URL secret |
| `status` | `pending`, `viewed`, `signed`, `declined`, `expired` |
| `sent_by`, `sent_at`, `expires_at` | default expiry seven days |
| `viewed_at` | **advisory** — see below |
| `signed_at`, `signed_name` | what they typed, and when |
| `consent_text` | the exact wording shown at signing time, stored verbatim |
| `document_hash` | **hash of the body as it was at send time** |
| `declined_reason` | |
| `signature_ip`, `signature_user_agent` | attribution evidence |

**Why `document_hash` lives on the signature row and not only on the document.**
It is snapshotted when the request is sent. Editing the document afterwards cannot
retroactively change what was signed, and a mismatch between `documents.body_hash`
and `document_signatures.document_hash` makes a signature against a superseded
version *detectable* instead of silent. Storing the hash only on the document would
mean the evidence changes when the evidence changes.

`consent_text` is stored for the same reason: proving someone consented requires
knowing what they were shown, and that wording will be edited over time.

## Template engine

`src/server/documents/templates.ts`, filling the existing `[BRACKETED]` convention
already used across `docs/contracts/` and `docs/templates/`: `[CLIENT LEGAL NAME]`,
`[CLIENT ADDRESS]`, `[PROJECT NAME]`, `[AMOUNT]`, `[RATE]`, `[DATE]`, `[STATE]`,
`[ENTITY TYPE]`, `[TITLE]`, `[NUMBER]`, `[MSA DATE]`, `[BUSINESS ADDRESS]`.

Two fail-closed rules, both consistent with how gates work elsewhere in this
codebase:

1. **`[REVIEW]` is not a merge field.** It is an attorney-review flag. The engine
   must never fill it, and must refuse to finalise a document that still contains
   one.
2. **An unfilled placeholder blocks the send.** A document going to a client with
   `[CLIENT LEGAL NAME]` still in it is worse than no document. Finalising fails
   loudly and names the offending placeholders.

Rule 1 is what keeps the un-reviewed MSA off a client's screen without needing a
separate mechanism to remember that it is dangerous.

## Flow and routes

**Authoring** — `/crm/deals/$id` gains a Documents section: pick a template,
generate a filled draft from deal/company/contact data, preview, finalise, send.

**Signing** — `sign.$token`, a public route following `api.unsubscribe.$token`
exactly, for the same reason it was built that way:

- **GET renders the document and a consent form. It never signs.**
- **POST signs**, and requires the consent checkbox plus a typed name.

Mail clients and security scanners prefetch links. A prefetched unsubscribe was
judged unacceptable when the campaign engine shipped; a prefetched *signature* is
categorically worse. The GET/POST split is what prevents it, and it is also what
RFC 8058 one-click required for unsubscribe — the same discipline, a higher stake.

**`viewed_at` is advisory and documented as such.** It is written on GET, so a
scanner can trigger it. It is a convenience for the operator, never evidence.
`signed_at` requires POST and cannot be produced by a prefetch.

## Gate enforcement

Advancing a deal to stage 4 requires a `signed` `document_signatures` row for a
`sow` document on that deal. Enforced inside the stage-advance RPC — the same
fail-closed, definer-RPC pattern the operator-control foundation uses, so it cannot
be bypassed by writing the table directly.

Payment is surfaced, not enforced: `invoices.paid_at` for the deal's invoice shows
as an unmet condition on the deal. Chosen so a Stripe reconciliation problem cannot
block work that is genuinely signed.

## Testing

Node suite, matching existing conventions (`node --experimental-strip-types`, no
Deno globals or `https://` imports in shared modules):

- Template fill produces expected output from a known deal
- Finalise **refuses** a body containing `[REVIEW]`
- Finalise **refuses** a body containing any unfilled `[BRACKETED]` placeholder
- `body_hash` is stable for identical input
- Sending snapshots `document_hash` onto the signature row
- Editing a document after send makes the mismatch detectable
- GET on `sign.$token` does not set `signed_at`
- POST without consent, or with a blank name, is refused
- An expired token is refused
- Stage 4 is blocked without a signed SOW, and permitted with one

## Out of scope

- **PDF generation.** No headless browser in Workers. The stored body plus its hash
  is the record; a PDF export can be added later without changing the schema
- **Storage buckets.** Nothing here needs one
- **`signing_order` / multi-party** — column dropped until there is a second signer
- **A provider adapter** — added when a provider is actually wanted
- **The MSA**, until its attorney review lands. The engine refuses it meanwhile
- **Stages 8 and 11.** Acceptance and Retro have no markdown template written yet.
  Signing is enabled for SOW now; Acceptance follows once its template exists

## Open questions

1. **No PDF.** If a client expects a PDF to file, the markdown-is-the-record
   position needs revisiting before implementation, not after.
2. **`signing_order` dropped.** If the studio countersigns, or a client has two
   owners, v1 is awkward and the column comes back.
3. **Hard-blocking stage 4** will stop the operator on their own deals. Accepted
   deliberately; revisit if it becomes friction rather than discipline.
