# Video Agent Media Handoff Design

**Status:** Approved as the first end-to-end delivery release through operator delegation on 2026-08-21.

## Purpose

Close the gap between a private Studio render request and an operator-reviewable media package. Today the Studio securely records an approved render request and the VPS worker produces local fixture exports, but the completion and export metadata do not return to the Studio database. This release adds a private object-storage boundary and a signed, idempotent worker callback so a completed render becomes durable Studio assets and exports ready for edit review.

## Program Roadmap

The complete GivenTake marketing agent system is delivered in four independently deployable releases:

1. **Media handoff:** private storage, signed worker result callback, durable asset/export records, and edit-review presentation.
2. **Provider execution:** one real provider behind the existing policy boundary, asynchronous polling/cancellation, rate reservation, cost reconciliation, and one-job activation.
3. **Marketing operations:** brand memory, campaign brief generation, compliant caption/copy variants, content-calendar records, and platform draft packages.
4. **Distribution and learning:** human-approved platform publication, analytics ingestion, experiment scoring, and separately approved advertising controls.

This specification covers only Release 1. It intentionally leaves paid generation, social publishing, and ad spend disabled.

## Decisions

### Private Storage

Use a private Supabase Storage bucket named `studio-media`. The browser never receives a bucket listing, object key, service role key, provider URL, or upload token. The Studio server is the only component with the Supabase service role. The worker receives a short-lived, single-object upload intent only after it has assembled an approved output.

Objects use this immutable path shape:

```text
tenants/<tenant-id>/campaigns/<campaign-id>/revisions/<revision-id>/renders/<render-job-id>/<profile>.mp4
```

`profile` is one of `vertical`, `square`, or `landscape`. The Storage bucket is private. Storage object policies do not grant broad browser access; Studio serves a signed download URL only to an authenticated tenant member viewing a known export record.

### Signed Worker Callback

Add Studio server endpoints under a non-public machine boundary:

- `POST /api/studio/worker/upload-intents`: accepts a worker-signed render job ID plus a bounded list of expected output profiles. It validates that the job belongs to one tenant, is in `submitted` or `rendering`, and has no final callback. It returns an upload target for each profile.
- `POST /api/studio/worker/completions`: accepts a worker-signed, idempotent completion manifest. It validates the HMAC timestamp/request ID, tenant/job/revision consistency, allowed profiles, non-empty SHA-256 checksums, positive byte sizes, dimensions, and render state.

The callback uses a new completion-specific request ID recorded in the database. A replay returns the existing result without creating a second asset or export. A mismatch or invalid state records a bounded failure code and fails closed. The callback does not accept media bytes, provider payloads, raw errors, public URLs, or arbitrary object keys.

### Worker Upload Sequence

1. The Studio creates and signs a render job only after storyboard approval and budget validation.
2. The worker performs rendering/post-production.
3. The worker requests upload intents for exactly the three known profiles.
4. The Studio creates short-lived signed upload targets in the private bucket and records immutable issuance facts scoped to the render job.
5. The worker uploads each local export directly to its target, computes/returns a SHA-256 checksum and media metadata, then posts the signed completion manifest.
6. The Studio verifies every required profile, persists `assets` and `exports`, records an immutable audit event, marks the render job `completed`, and transitions the campaign to `awaiting_edit_approval`.
7. An operator/reviewer can inspect export metadata and request short-lived read URLs through authenticated server functions. The client never has direct Storage access.

### Delivery And Identity

The existing `STUDIO_WORKER_SHARED_SECRET` authenticates both directions. A callback request includes a UTC timestamp, UUID request ID, and HMAC over stable JSON. The server accepts timestamps within five minutes and rejects repeated IDs. Upload-intent creation uses the same signature contract and caps one active intent per job/profile.

The active Studio membership determines all operator/reviewer reads. The callback resolves tenant identity solely from the persisted render job and independently verifies the worker-provided tenant ID. The browser cannot supply an authoritative tenant ID, render job state, storage key, or callback status.

## Data Model

Add a migration after `202608210001_video_studio_core.sql`.

### New Types

- `asset_state`: `pending`, `ready`, `failed`.

### New Tables

- `render_upload_intents`: immutable per-job/profile issuance record with `tenant_id`, `render_job_id`, `profile`, a generated `storage_key`, an expiry, a request ID, and a monotonically increasing attempt number. It has `unique (tenant_id, render_job_id, profile, attempt)`. The signed upload token itself is never stored in Postgres.
- `render_completions`: one immutable accepted completion fact per render job with job/revision identifiers, callback request ID, and accepted time. It has `unique (tenant_id, render_job_id)` and `unique (request_id)`. Rejected callback facts remain bounded audit events and, when terminal, a sanitized render-job failure code.

Extend `assets` with `profile`, `state`, `width`, `height`, `duration_seconds`, and a composite foreign key to the render job. Add `unique (tenant_id, render_job_id, profile)`. `exports` must reference a ready asset with the matching profile and render job.

All records carry `tenant_id`, use tenant-consistent foreign keys, have forced RLS, and are read-only to tenant members. Browser-facing roles receive no direct insert/update/delete policy for upload intents, completions, assets, or exports. Only a server-side service-role RPC may record an accepted completion; the callback itself is authenticated at the application boundary with the worker HMAC and never connects to Postgres. Service-role use is confined to that RPC, Storage signed upload/read URL creation, and deployment/bootstrap operations.

## State Transitions

The domain state machine adds:

```text
rendering -> awaiting_edit_approval  (only after accepted completion with 3 ready exports)
rendering -> failed                  (terminal rejected/failed callback)
```

The worker updates no Studio campaign state directly. The Studio callback coordinates all durable state changes in one database transaction/RPC so partial uploads, duplicate callbacks, and retries cannot create a false completion.

If upload or completion fails, the job remains `rendering` or becomes `failed` with a sanitized code. No edit approval or export handoff is possible until a complete accepted manifest exists.

## Studio User Experience

The private `/studio` screen keeps creation, planning, and approval roles. When a render is in progress, it displays an intentionally neutral `Rendering` state. Once a completion is accepted, it shows a stable export package with three profile rows, dimensions, duration, checksum prefix, and an authenticated `Preview` action that opens a short-lived signed URL. It does not embed provider media URLs, upload tokens, costs, or worker diagnostics.

Reviewers can approve the edit only after the package is complete. Viewers can inspect metadata/preview records but cannot mutate them. A failed completion shows a neutral unavailable state; only the operator audit view exposes the bounded reason code.

## Environment And Operations

New server-only application configuration:

```dotenv
STUDIO_MEDIA_BUCKET=studio-media
STUDIO_MEDIA_UPLOAD_TTL_SECONDS=900
STUDIO_MEDIA_READ_TTL_SECONDS=300
```

The worker retains `STUDIO_WORKER_SHARED_SECRET` and needs no Supabase service-role key. It receives upload targets only after a valid signed request. The Studio app must have `SUPABASE_SERVICE_ROLE_KEY` on the server to create a private bucket/upload intent and read URL.

The release requires a migration, private bucket creation, database/RLS tests, callback contract tests, a worker integration test using a fake upload-target client, and a controlled fixture run. The controlled run keeps real provider selection as `fixture`, disables both kill switches for one observed job only, verifies all three private objects plus database records, restores both kill switches, and records acceptance.

## Failure Handling

- Reject clock-skewed, missing, malformed, or replayed signatures without revealing worker or storage details.
- Reject a callback for a job outside the pending/rendering state, a tenant/revision mismatch, an unexpected/missing profile, duplicate profile, unsafe key, wrong dimensions, invalid checksum, or zero byte size.
- Never delete/overwrite a ready export. A retry creates a new campaign revision/render job after operator review.
- On callback failure, retain sanitized audit facts and no secrets, raw provider body, signed URL, or upload token.
- On storage upload failure/expiry, mark the intent expired and issue a new intent only to the same valid render job. No bucket policy becomes public as a recovery shortcut.

## Verification

The release is complete only when all of these pass:

- pgTAP proves cross-tenant users cannot read assets/intents/completions or mutate them directly, and completion records are immutable.
- Unit tests prove stable callback signing, intent/completion schema validation, idempotent replay behavior, state transition requirements, and tenant mismatch rejection.
- Worker integration tests prove fixture outputs upload only to issued targets and post a three-profile completion manifest.
- Studio route tests prove only a tenant member can request an export preview and no browser code contains storage/service credentials or media tokens.
- Local Docker fixture run proves three private objects, three ready exports, one accepted completion, and a transition to edit review.
- The existing full test suite, lint, production build, and accessibility pass remain green.

## Out Of Scope

Real provider SDKs, media generation spend, content copy generation, scheduling, direct publishing, social API tokens, analytics ingestion, experiment optimization, client invitations, avatar/UGC assets, CRM syncing, and phone/call-center behavior remain outside this release. They are governed by the remaining releases in the program roadmap.
