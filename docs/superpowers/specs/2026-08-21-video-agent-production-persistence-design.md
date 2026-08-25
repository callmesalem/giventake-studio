# Video Agent Production Identity And Persistence Design

**Status:** Approved through standing operator delegation on 2026-08-21.

## Purpose

Turn the local-only Video Agent Studio into a durable private application. The release adds Supabase authentication, Studio tenant membership, PostgreSQL persistence, row-level security, and the server-only control-plane boundary required before the worker can receive an approved job.

The public GivenTake Devs website remains public and does not expose Studio data, render controls, provider credentials, worker secrets, or exports.

## Decision

Use Supabase Auth and managed PostgreSQL. The Studio owns an isolated `video_studio` schema with tenant tables, rather than referencing Growth OS tables directly. It adopts the same cookie-aware server client, service-role separation, explicit RLS policies, sanitized audit records, and invitation-ready membership model already proven in Growth OS.

This avoids a deployment dependency on the unmerged Growth OS application while allowing both products to use the same Supabase Auth project. Tenant consolidation is a later, deliberate migration rather than an implicit database dependency.

## Scope

This release delivers:

- Email magic-link sign-in, callback, sign-out, and protected `/studio` access.
- `video_studio` migration files, indexes, immutable audit records, and tenant RLS tests.
- Durable campaigns, revisions, approvals, exports, render-job records, and asset metadata.
- A PostgreSQL repository that preserves the existing Studio service/state-machine contracts.
- A server-only, idempotent handoff of an approved persistent render job to the signed VPS worker.
- A default-deny production configuration. Fixture mode remains available only for controlled operator verification.

It does not deliver real Sora, ComfyUI, avatar, UGC, social publishing, advertising spend, client invitations, object-storage uploads, or public Studio exposure. Those come after persistence and operator-controlled activation are verified.

## Access Model

Supabase Auth establishes the user session. Server actions resolve a Studio identity from that session plus the active tenant cookie; browser input never supplies an actor or authoritative tenant id.

`video_studio.memberships` assigns one of three roles per tenant:

- `operator`: create campaigns, plan, approve, queue renders, manage brands, and hand off exports.
- `reviewer`: view campaigns and approve storyboard, edit, and handoff checkpoints.
- `viewer`: read-only access.

Every Studio record has `tenant_id`. RLS is enabled and forced on every tenant-owned table. Policies permit reading only for active members, writing campaign content only for operators, and approval creation only for operators and reviewers. Audit rows are written through a security-definer function after validating the caller's membership and sanitized metadata; direct audit modification is denied.

The initial production bootstrap is intentionally manual: create the first Supabase Auth user, tenant, and operator membership through a documented server-side/admin SQL procedure. No email address, bootstrap secret, or service-role credential is embedded in a browser bundle.

## Data Model

The schema contains:

- `tenants` and `memberships`: Studio organization boundary and role grants.
- `brands`: per-tenant name, public website, CTA, and non-secret visual settings.
- `campaigns`: durable brief, status, budget ceiling, current revision, and timestamps.
- `campaign_revisions`: immutable brief and storyboard snapshots with a monotonic revision number.
- `approvals`: immutable human approval facts tied to a specific revision.
- `render_jobs`: idempotent worker-control records with provider/model, requested and reserved budget, worker job id, state, and sanitized failure code.
- `assets`: metadata only: storage key, media profile, SHA-256, byte size, and lifecycle status. Media bytes and signed URLs remain outside PostgreSQL.
- `exports`: profile-specific outputs linked to a completed render job and asset metadata.
- `audit_events`: append-only, sanitized actor/action/target/request records.

Database constraints enforce positive budgets, valid workflow states, tenant-consistent composite foreign keys, unique revision numbers, unique worker idempotency keys, and safe audit metadata. Tenant/time indexes support the queue, campaign list, approval history, and export list without full-table scans.

## Application Boundary

`StudioRepository` becomes asynchronous. A Supabase implementation uses the cookie-bound user client for tenant-scoped reads and mutations. The current deterministic in-memory repository remains an explicit development fallback only when Supabase is not configured; it is unavailable in production.

The service remains the workflow authority. It validates input, current status, revision-specific approvals, and budgets before requesting a render. A database transaction/RPC creates the render-job record exactly once, records the audit event, and gives the server a stable UUID idempotency key. Failed downstream worker submission is recorded as a sanitized control-plane failure without inventing a completed render.

The final worker payload is assembled on the server from the persisted tenant, brand, campaign, and revision. It is signed with `STUDIO_WORKER_SHARED_SECRET` and sent through `production-worker-client.ts`. Browser clients never see the worker URL, request signature, provider/model choices, or shared secret.

## Private Route And Session Flow

`/studio` becomes a private application route. Its loader/action boundary requires a session and a Studio membership before returning data. An unauthenticated request is redirected to `/studio/sign-in`; a session with no membership receives a neutral access-denied response. The route is no longer tied to `import.meta.env.DEV`.

The current form stops carrying `tenantId`. The server resolves the selected tenant and injects it. A first release with one membership selects that tenant automatically; a future tenant selector appears only when a user has more than one Studio membership.

## Worker And Provider Safety

The signed VPS worker contract remains unchanged. The worker is still fixture-only and its outbound kill switch defaults to `true`. The Studio control plane may send a fixture job only when all of these are true:

1. The actor is an operator for the campaign tenant.
2. The campaign is approved for generation and its current revision has storyboard approval.
3. The requested provider/model is explicitly allowlisted and has a configured non-negative price policy.
4. The rendered reservation does not exceed the stored campaign budget.
5. The control plane URL and shared secret are configured server-side.
6. The global outbound kill switch is explicitly disabled for the controlled run.

Real paid-provider enablement remains a separate release. It will add provider-specific adapters, private media storage/download, status polling, cancellation, cost reconciliation, health monitoring, and a documented one-job activation procedure.

## Configuration And Deployment

Required server-side configuration:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- `STUDIO_APP_URL`
- `STUDIO_WORKER_URL` and `STUDIO_WORKER_SHARED_SECRET`
- `STUDIO_OUTBOUND_KILL_SWITCH=true` by default
- `STUDIO_ALLOWED_RENDER_PROVIDERS` and `STUDIO_PROVIDER_RATES_JSON`

No value above may use a `VITE_` prefix except the public Supabase URL/anon key if the framework requires it; the application still constructs sessions only at server boundaries. Production needs an explicit production Supabase project, daily backups, a verified app origin/redirect URL, and an operator bootstrap before `/studio` is deployed.

## Failure Handling And Audit

Authentication, membership, tenant mismatch, stale revisions, invalid transitions, missing price policies, unavailable control-plane configuration, duplicate requests, and worker rejections fail closed. User-facing errors are neutral. Logs and audits use bounded reason codes and never retain API keys, worker signatures, raw provider bodies, signed URLs, or media bytes.

## Verification

The release verifies:

- Migration reset and pgTAP tests for cross-tenant denial, role restrictions, audit immutability, and tenant-consistent references.
- Repository/service contract tests for identity injection, duplicate render prevention, state transitions, and worker payload assembly.
- Auth action tests for sign-in, callback validation, redirect safety, and sign-out.
- Existing Studio, worker, build, lint, and accessibility tests.
- A controlled container fixture run only after the authenticated control-plane test uses a non-production local Supabase environment.

## Follow-On Releases

After this release is deployed and verified with a fixture job, the next sequence is:

1. Private object storage and asset ingestion.
2. One real video provider with health, poll, cancellation, and cost reconciliation.
3. Marketing distribution drafts and per-platform human publishing approval.
4. Avatar/UGC composition and measured campaign learning loops.
