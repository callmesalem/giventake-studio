# Video Agent Production Identity And Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Video Agent Studio an authenticated, tenant-isolated, durable private application that can safely submit a controlled fixture render to the signed VPS worker.

**Architecture:** Add a Studio-owned `video_studio` schema to Supabase, with membership-aware RLS and immutable audit events. Replace the synchronous in-memory-only Studio server with an async repository boundary that selects Supabase in production and an explicit deterministic in-memory implementation only during development. Require the authenticated server identity for every action and construct signed worker jobs from persisted data only.

**Tech Stack:** TanStack Start, React 19, TypeScript, Zod, Supabase Auth/Postgres/RLS, `@supabase/ssr`, `@supabase/supabase-js`, Node test runner, pgTAP/Supabase CLI, Docker, FFmpeg.

**Spec:** `docs/superpowers/specs/2026-08-21-video-agent-production-persistence-design.md`

## Global Constraints

- The public GivenTake Devs website remains public; `/studio` requires a valid Supabase session and Studio membership.
- Every tenant-owned row must carry `tenant_id`, use tenant-consistent foreign keys, and have RLS enabled and forced.
- Browser requests never carry an authoritative actor or tenant id, worker URL, worker signature, provider secret, service-role key, or signed media URL.
- Production missing Supabase or Studio configuration fails closed; the in-memory repository is development-only.
- `STUDIO_OUTBOUND_KILL_SWITCH` defaults to `true`; fixture is the only eligible provider in this release.
- Audit rows must be append-only and contain bounded, sanitized reason codes/metadata only.
- Do not add paid-provider, object-storage byte upload, social publishing, avatar, UGC, or advertising-spend behavior in this release.
- Preserve the existing `ProductionRenderJob` HMAC contract and production worker's localhost-only posture.

---

## File Structure

- `supabase/config.toml`: local Supabase project configuration.
- `supabase/migrations/202608210001_video_studio_core.sql`: Studio schema, enums, tenant tables, data constraints, indexes, audit trigger/function, and RLS policies.
- `supabase/tests/video_studio_rls.test.sql`: pgTAP tests for membership, mutation role, cross-tenant denial, and audit immutability.
- `src/lib/studio/database.types.ts`: minimal generated-style TypeScript types for the `video_studio` schema.
- `src/lib/studio/supabase.server.ts`: cookie-aware user client and server-only service-role client.
- `src/lib/studio/auth.ts`: session identity, magic-link, callback, sign-out, and neutral auth errors.
- `src/lib/studio/identity.ts`: active-tenant resolution and role checks from an authenticated membership.
- `src/lib/studio/repository.ts`: async deterministic development repository.
- `src/lib/studio/supabase-repository.ts`: persistent repository implementation.
- `src/lib/studio/server.ts`: configured repository/service composition with production default-deny behavior.
- `src/lib/studio/service.ts`: async state machine orchestration, render-job creation, and audit facts.
- `src/lib/studio/render-request.ts`: persisted render-job payload assembly and provider-policy parsing.
- `src/lib/studio/actions.ts`: authenticated server functions with tenant injection and controlled worker submission.
- `src/routes/studio.tsx`: private Studio screen with no client-supplied tenant id.
- `src/routes/studio.sign-in.tsx`, `src/routes/studio.auth.callback.ts`: sign-in and callback routes.
- `tests/video-studio-auth.test.mjs`: session/callback behavior and no-session denial contracts.
- `tests/video-studio-identity.test.mjs`: membership resolution and role contracts.
- `tests/video-studio-persistence.test.mjs`: repository selection, durable record mapping, and production fail-closed tests.
- `tests/video-studio-render-request.test.mjs`: render-job policy/payload/idempotency tests.
- `tests/video-studio-actions.test.mjs`, `tests/video-studio-ui.test.mjs`, existing Studio tests: updated async and authenticated contracts.
- `.env.example`, `docs/operations/07-marketing-ops/video-agent-studio.md`, `docs/operations/07-marketing-ops/video-agent-production-worker.md`: safe configuration and controlled fixture activation instructions.

## Task 1: Add The Studio Database Boundary

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202608210001_video_studio_core.sql`
- Create: `supabase/tests/video_studio_rls.test.sql`
- Create: `src/lib/studio/database.types.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Test: `supabase/tests/video_studio_rls.test.sql`

**Interfaces:**
- Produces the `video_studio` schema and `can_access_tenant(uuid)`, `can_operate_tenant(uuid)`, `can_approve_tenant(uuid)`, and `write_audit_event(...)` SQL functions.
- Produces database records whose fields match `CampaignRecord`, `CampaignRevision`, `ApprovalRecord`, `ExportRecord`, and the new `RenderJobRecord` type introduced in Task 2.
- Consumed by `createStudioUserSupabase` and `createStudioServiceSupabase` in Task 3, and `createSupabaseStudioRepository` in Task 4.

- [ ] **Step 1: Add a failing pgTAP policy test**

Create a test that creates two `auth.users`, two Studio tenants, an operator membership in the first tenant, a reviewer membership in the first tenant, and an operator membership in the second tenant. Assert all of these failures/successes:

```sql
select plan(9);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

select lives_ok(
  $$ select * from video_studio.campaigns where tenant_id = '10000000-0000-0000-0000-000000000001' $$,
  'operator can read own tenant'
);
select is_empty(
  $$ select * from video_studio.campaigns where tenant_id = '20000000-0000-0000-0000-000000000001' $$,
  'operator cannot read another tenant'
);
select throws_ok(
  $$ insert into video_studio.campaigns (...) values (...) $$,
  '42501',
  null,
  'reviewer cannot create campaigns'
);
select lives_ok(
  $$ insert into video_studio.approvals (...) values (...) $$,
  'reviewer can create a revision approval'
);
select throws_ok(
  $$ update video_studio.audit_events set action = 'tampered' $$,
  '42501',
  null,
  'audit events cannot be changed'
);
select * from finish();
```

- [ ] **Step 2: Run the database test to verify the schema is absent**

Run: `npx supabase start && npx supabase test db --file supabase/tests/video_studio_rls.test.sql`

Expected: FAIL because the `video_studio` schema and tables do not exist.

- [ ] **Step 3: Add Supabase dependencies and configuration**

Add runtime dependencies and scripts:

```json
{
  "dependencies": {
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.49.1"
  },
  "scripts": {
    "test:studio-db": "supabase test db --file supabase/tests/video_studio_rls.test.sql"
  }
}
```

Create `supabase/config.toml` with project id `giventake-video-studio`, local API port `54321`, database port `54322`, Studio auth redirect allowlist entries for `http://localhost:3000/studio/auth/callback` and `http://localhost:8080/studio/auth/callback`, and no production credentials.

Add only blank/example server values to `.env.example`:

```dotenv
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STUDIO_APP_URL=http://localhost:3000
STUDIO_WORKER_URL=
STUDIO_WORKER_SHARED_SECRET=
STUDIO_OUTBOUND_KILL_SWITCH=true
STUDIO_ALLOWED_RENDER_PROVIDERS=fixture
STUDIO_PROVIDER_RATES_JSON={"fixture":{"fixture":0}}
```

- [ ] **Step 4: Implement the `video_studio` migration**

Create `video_studio` and define:

```sql
create type video_studio.membership_role as enum ('operator', 'reviewer', 'viewer');
create type video_studio.campaign_status as enum (
  'draft', 'planned', 'awaiting_storyboard_approval', 'approved_for_generation',
  'rendering', 'awaiting_edit_approval', 'exported', 'handed_off', 'archived', 'failed'
);
create type video_studio.render_status as enum (
  'queued', 'submitted', 'rendering', 'completed', 'failed', 'cancelled'
);
```

Create `tenants`, `memberships`, `brands`, `campaigns`, `campaign_revisions`, `approvals`, `render_jobs`, `assets`, `exports`, and `audit_events`. Require `tenant_id` everywhere after `tenants`; use composite `unique (tenant_id, id)` keys and composite foreign keys for child records. Store revision brief/storyboard as validated JSONB snapshots. Make `campaign_revisions` immutable after insertion, make `approvals` and `audit_events` immutable, enforce positive budget/reservation values, and add `unique (tenant_id, campaign_id, idempotency_key)` to `render_jobs`.

Define `can_access_tenant`, `can_operate_tenant`, and `can_approve_tenant` as `security definer`, `stable`, and `set search_path = ''`, always comparing `auth.uid()` with `video_studio.memberships.user_id`. Define `write_audit_event` as a `security definer` function that rejects missing membership, unknown tenant/campaign, unbounded action/target strings, or metadata that is not an object with scalar values. Enable and force RLS on every table. Give members select access, operators campaign/revision/render-job mutation rights, reviewers/operators approval insertion rights, and deny direct `audit_events` modification. Grant direct table access only to `authenticated` exactly where an RLS policy permits it; do not grant app roles to `anon`.

Create indexes:

```sql
create index campaigns_tenant_updated_idx on video_studio.campaigns (tenant_id, updated_at desc);
create index revisions_tenant_campaign_number_idx on video_studio.campaign_revisions (tenant_id, campaign_id, number desc);
create index approvals_tenant_campaign_created_idx on video_studio.approvals (tenant_id, campaign_id, created_at desc);
create index render_jobs_tenant_status_created_idx on video_studio.render_jobs (tenant_id, status, created_at desc);
create index exports_tenant_campaign_created_idx on video_studio.exports (tenant_id, campaign_id, created_at desc);
create index audit_events_tenant_created_idx on video_studio.audit_events (tenant_id, created_at desc);
```

- [ ] **Step 5: Add minimal generated-style database types**

Define a `StudioDatabase` type with the `video_studio` schema tables and row/insert/update shapes. Include enums as literal unions and model JSONB fields as the domain object types from `types.ts`. Keep it local to Studio; do not add a second cross-product global database declaration.

- [ ] **Step 6: Run migration and RLS verification**

Run: `npx supabase db reset && npm run test:studio-db`

Expected: all pgTAP assertions pass, including cross-tenant denial and audit immutability.

- [ ] **Step 7: Commit the database boundary**

```bash
git add package.json bun.lock .env.example supabase src/lib/studio/database.types.ts
git commit -m "feat: add studio tenant persistence schema"
```

## Task 2: Make Studio Domain Persistence Asynchronous

**Files:**
- Modify: `src/lib/studio/types.ts`
- Modify: `src/lib/studio/repository.ts`
- Modify: `src/lib/studio/service.ts`
- Create: `src/lib/studio/render-request.ts`
- Test: `tests/video-studio-domain.test.mjs`
- Test: `tests/video-studio-service.test.mjs`
- Test: `tests/video-studio-render-request.test.mjs`

**Interfaces:**
- Consumes Task 1 status/role database literals.
- Produces `RenderJobRecord`, async `StudioRepository`, `createRenderRequest`, and `buildProductionRenderJob` for Tasks 4 and 5.

- [ ] **Step 1: Write failing async service and render-request tests**

Add tests covering:

```js
const job = await service.requestRender(identity, campaign.id, {
  provider: "fixture",
  model: "fixture",
  idempotencyKey: "render-001",
});
assert.equal(job.status, "queued");
assert.equal(job.reservedCents, 0);
assert.throws(() => buildProductionRenderJob(job, campaign, revision, brand, {}), /missing/i);
assert.throws(() => createProviderPolicy({}, ["fixture"]), /pricing/i);
```

Include a duplicate idempotency test that returns the existing job instead of creating a second record, a stale revision approval test, an over-budget reservation test, and a worker payload test that proves only persisted brand/campaign/revision data appears in the payload.

- [ ] **Step 2: Run the focused tests to verify the async interfaces do not exist**

Run: `node --test tests/video-studio-service.test.mjs tests/video-studio-render-request.test.mjs`

Expected: FAIL because `requestRender`, `RenderJobRecord`, and `buildProductionRenderJob` are absent.

- [ ] **Step 3: Convert repository contracts to promises**

Change every `StudioRepository` operation to return `Promise`. Add:

```ts
export type RenderJobRecord = {
  id: string;
  tenantId: string;
  campaignId: string;
  revisionId: string;
  provider: string;
  model: string;
  requestedBudgetCents: number;
  reservedCents: number;
  idempotencyKey: string;
  workerJobId: string | null;
  status: "queued" | "submitted" | "rendering" | "completed" | "failed" | "cancelled";
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
};
```

Add `getBrand`, `createRenderJob`, `getRenderJobByIdempotencyKey`, `saveRenderJob`, and `getRenderJob` to the repository. Retain `createStudioRepository` as a deep-copy, deterministic development repository whose methods are `async`, and update all existing service tests to await operations.

- [ ] **Step 4: Add strict render request construction**

In `render-request.ts`, parse `STUDIO_ALLOWED_RENDER_PROVIDERS` as a comma-separated allowlist and `STUDIO_PROVIDER_RATES_JSON` as a map of non-negative cents-per-second rates. Require a provider/model match, compute one reservation from persisted scene durations, reject an absent rate or a reservation above campaign budget, and produce a `ProductionRenderJob` from persisted objects only.

```ts
export function createProviderPolicy(env: Record<string, string | undefined>) {
  return { assertAllowed(provider: string, model: string): number, reserve(job: ProductionRenderJob): number };
}

export function buildProductionRenderJob(input: {
  job: RenderJobRecord;
  campaign: CampaignRecord;
  revision: CampaignRevision;
  brand: StudioBrand;
}): ProductionRenderJob;
```

- [ ] **Step 5: Make service workflow operations asynchronous**

Await repository calls inside every state transition. Replace `queueRender` with `requestRender(identity, campaignId, request)` that verifies operator role at the caller boundary, current-revision storyboard approval, a non-zero campaign budget, allowed pricing, and idempotency before creating the job plus a `render.requested` audit event. Keep `completeRender`, edit approval, and handoff transitions unchanged in meaning.

- [ ] **Step 6: Run focused domain tests**

Run: `node --test tests/video-studio-domain.test.mjs tests/video-studio-service.test.mjs tests/video-studio-render-request.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit the async domain boundary**

```bash
git add src/lib/studio/types.ts src/lib/studio/repository.ts src/lib/studio/service.ts src/lib/studio/render-request.ts tests/video-studio-domain.test.mjs tests/video-studio-service.test.mjs tests/video-studio-render-request.test.mjs
git commit -m "feat: add durable studio render requests"
```

## Task 3: Add Supabase Sessions And Studio Identity

**Files:**
- Create: `src/lib/studio/supabase.server.ts`
- Create: `src/lib/studio/auth.ts`
- Modify: `src/lib/studio/identity.ts`
- Test: `tests/video-studio-auth.test.mjs`
- Test: `tests/video-studio-identity.test.mjs`

**Interfaces:**
- Consumes `StudioDatabase` from Task 1 and authenticated Supabase browser cookies.
- Produces `requireStudioIdentity(): Promise<StudioIdentity>` and `requireStudioRole(identity, "operator" | "reviewer")` for Tasks 4 and 5.

- [ ] **Step 1: Write failing auth and identity tests**

Test the pure dependency-injected paths:

```js
assert.equal(await getAuthenticatedStudioUserFrom(async () => ({ data: { user: null }, error: null })), null);
await assert.rejects(() => requireStudioIdentityFrom({ user: null, memberships: [] }), /UNAUTHENTICATED/);
await assert.rejects(() => requireStudioIdentityFrom({ user: owner, memberships: [] }), /TENANT_FORBIDDEN/);
assert.deepEqual(await requireStudioIdentityFrom({ user: owner, memberships: [member] }), {
  tenantId: member.tenantId,
  actorId: owner.id,
  role: "operator",
});
```

Test that magic-link input accepts a valid normalized email but returns the same `{ accepted: true }` response for both provider success and provider failure, and test that callback redirects only to `/studio`.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node --test tests/video-studio-auth.test.mjs tests/video-studio-identity.test.mjs`

Expected: FAIL because the auth/session modules do not exist.

- [ ] **Step 3: Implement cookie-aware Supabase clients**

Create `createStudioUserSupabase()` using `createServerClient` from `@supabase/ssr`, `getRequestHeader("cookie")`, `parseCookieHeader`, and `setCookie`. Set cookies with `httpOnly: true`, `sameSite: "lax"`, and `secure: process.env.NODE_ENV === "production"`. Create `createStudioServiceSupabase()` with the service role key, `persistSession: false`, and `autoRefreshToken: false`; only files importing `@tanstack/react-start/server-only` may call it.

- [ ] **Step 4: Implement neutral magic-link/session actions**

Create a small `StudioAuthError` union: `UNAUTHENTICATED`, `AUTH_CALLBACK_INVALID`, `TENANT_FORBIDDEN`, and `ROLE_FORBIDDEN`. Implement `requestStudioMagicLink`, `completeStudioAuthCallback`, `getAuthenticatedStudioUser`, and `signOutStudioUser`. Normalize email, set the redirect to exactly `${STUDIO_APP_URL}/studio/auth/callback`, never echo account existence/provider failure, and reject callbacks without a code/session.

- [ ] **Step 5: Implement active-tenant identity resolution**

Replace env identity with an async membership query. `requireStudioIdentity` loads `auth.getUser()`, reads `gt_studio_active_tenant`, and queries only the user's `video_studio.memberships`. It automatically selects a sole membership; it rejects missing membership, an unknown requested tenant, and a requested tenant outside the user's memberships. Extend the identity type with the role. `requireStudioRole` allows operators only for campaign/render mutation and operators/reviewers for approval mutations.

- [ ] **Step 6: Run focused auth/identity tests**

Run: `node --test tests/video-studio-auth.test.mjs tests/video-studio-identity.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit authenticated identity**

```bash
git add src/lib/studio/supabase.server.ts src/lib/studio/auth.ts src/lib/studio/identity.ts tests/video-studio-auth.test.mjs tests/video-studio-identity.test.mjs
git commit -m "feat: add studio authenticated identity"
```

## Task 4: Implement The Persistent Repository And Protected Worker Handoff

**Files:**
- Create: `src/lib/studio/supabase-repository.ts`
- Modify: `src/lib/studio/server.ts`
- Modify: `src/lib/studio/actions.ts`
- Modify: `src/lib/studio/worker.ts`
- Test: `tests/video-studio-persistence.test.mjs`
- Test: `tests/video-studio-actions.test.mjs`
- Test: `tests/video-worker-client.test.mjs`

**Interfaces:**
- Consumes Task 2 async repository/service and Task 3 `requireStudioIdentity`.
- Produces `getStudioServer(): Promise<StudioServer>` and authenticated actions that can safely enqueue only a persisted fixture render.

- [ ] **Step 1: Write failing persistence/action tests**

Add tests proving:

```js
await assert.rejects(() => getStudioServerFor({ NODE_ENV: "production" }), /Supabase/i);
const server = await getStudioServerFor({ NODE_ENV: "development" });
assert.equal(server.repository.kind, "memory");
await assert.rejects(() => renderStudioCampaign.handler({ campaignId }), /ROLE_FORBIDDEN/);
assert.equal(fakeWorker.enqueueCalls.length, 1);
assert.equal(fakeWorker.enqueueCalls[0].tenantId, approvedCampaign.tenantId);
assert.equal(fakeWorker.enqueueCalls[0].id, persistedJob.id);
```

Test worker failure changes the job to `failed` with a bounded `WORKER_UNAVAILABLE` code and does not add a completed export. Test duplicate render action idempotency calls the worker once.

- [ ] **Step 2: Run persistence/action tests to verify failure**

Run: `node --test tests/video-studio-persistence.test.mjs tests/video-studio-actions.test.mjs`

Expected: FAIL because no persistent repository or authenticated worker handoff exists.

- [ ] **Step 3: Implement `createSupabaseStudioRepository`**

Map snake_case database rows to camelCase domain records in one module. Scope every lookup with `tenant_id`; require `maybeSingle()` for unique fetches and reject unexpected query errors. For campaign revisions, approvals, exports, and jobs, verify parent campaign/revision tenant equality before returning records. Use an RPC or a unique conflict fetch for `createRenderJob` so `(tenant_id, campaign_id, idempotency_key)` is stable under retries. Do not invoke the service-role client for user-initiated reads/writes; RLS must observe the authenticated user session.

- [ ] **Step 4: Make server composition production-safe**

`getStudioServer` selects Supabase only when `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and a valid current Studio session are available. In development, no Supabase configuration selects the memory repository. In production, missing configuration throws `StudioConfigurationError("STUDIO_PERSISTENCE_UNAVAILABLE")`; no implicit env identity remains. Keep a test-only constructor to inject a repository/service/client without setting global state.

- [ ] **Step 5: Wire approved jobs to the signed worker client**

Update `renderStudioCampaign` to:

```ts
const identity = await requireStudioIdentity();
requireStudioRole(identity, "operator");
const job = await server.service.requestRender(identity, data.campaignId, request);
if (process.env.STUDIO_OUTBOUND_KILL_SWITCH !== "false") return job;
const payload = await server.repository.buildProductionJob(identity.tenantId, job.id);
const worker = createProductionWorkerClient(readStudioWorkerConfig());
const response = await worker.enqueue(payload);
return server.repository.markRenderJobSubmitted(identity.tenantId, job.id, response.id);
```

`readStudioWorkerConfig` requires a valid HTTPS/private URL and a non-empty secret; it throws before any request if configuration is incomplete. A worker rejection is caught only to persist `failed` and `WORKER_UNAVAILABLE`; it is then returned as a neutral action error. Fixture worker simulation is retained only for development tests and is never called in a production configuration.

- [ ] **Step 6: Run persistence/action/worker tests**

Run: `node --test tests/video-studio-persistence.test.mjs tests/video-studio-actions.test.mjs tests/video-worker-client.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit persistent Studio control plane**

```bash
git add src/lib/studio/supabase-repository.ts src/lib/studio/server.ts src/lib/studio/actions.ts src/lib/studio/worker.ts tests/video-studio-persistence.test.mjs tests/video-studio-actions.test.mjs tests/video-worker-client.test.mjs
git commit -m "feat: persist and protect studio render control"
```

## Task 5: Make The Studio Route Private And Tenant-Injected

**Files:**
- Create: `src/routes/studio.sign-in.tsx`
- Create: `src/routes/studio.auth.callback.ts`
- Modify: `src/routes/studio.tsx`
- Modify: `src/lib/studio/actions.ts`
- Test: `tests/video-studio-ui.test.mjs`
- Test: `tests/video-studio-e2e.test.mjs`

**Interfaces:**
- Consumes `requestStudioMagicLink`, `completeStudioAuthCallback`, `signOutStudioUser`, and authenticated Studio actions from Tasks 3 and 4.
- Produces the authenticated operator UI and no public rendering control surface.

- [ ] **Step 1: Write failing private-route/UI tests**

Test the route contract and component behavior:

```js
assert.match(readFileSync("src/routes/studio.tsx", "utf8"), /requireStudioIdentity/);
assert.doesNotMatch(readFileSync("src/routes/studio.tsx", "utf8"), /const tenantId =/);
assert.doesNotMatch(readFileSync("src/routes/studio.tsx", "utf8"), /import\.meta\.env\.DEV/);
assert.match(readFileSync("src/routes/studio.sign-in.tsx", "utf8"), /Email address/);
assert.match(readFileSync("src/routes/studio.auth.callback.ts", "utf8"), /completeStudioAuthCallback/);
```

Add an e2e fixture that asserts an unauthenticated visitor receives the sign-in page, no campaign content appears in its HTML, and an authenticated test identity sees only its own tenant's campaigns.

- [ ] **Step 2: Run the UI tests to verify existing dev-only behavior fails the contract**

Run: `node --test tests/video-studio-ui.test.mjs tests/video-studio-e2e.test.mjs`

Expected: FAIL because the current route is development-only and carries `tenantId` in browser state.

- [ ] **Step 3: Implement sign-in and callback routes**

Create a focused sign-in form with one email field, neutral “Check your inbox” success copy, accessible labels, disabled submit while pending, and no account enumeration. The callback route parses only `code`, calls `completeStudioAuthCallback`, then redirects to `/studio`; malformed callbacks redirect to `/studio/sign-in?error=expired`. Add a compact sign-out action in the Studio header.

- [ ] **Step 4: Convert the Studio screen to server-authorized data**

Require identity through a server loader/action before list and mutation results. Remove the `tenantId` browser constant and omit `tenantId` from the create input schema sent by React. Keep the existing workflow controls and visual language, but render action buttons by role: operator receives planning/render actions, reviewer receives approval actions, viewer receives no mutation action. Show neutral unavailable messages without raw database/worker details.

- [ ] **Step 5: Run route and UI contract tests**

Run: `node --test tests/video-studio-ui.test.mjs tests/video-studio-e2e.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit private Studio routes**

```bash
git add src/routes/studio.tsx src/routes/studio.sign-in.tsx src/routes/studio.auth.callback.ts src/lib/studio/actions.ts tests/video-studio-ui.test.mjs tests/video-studio-e2e.test.mjs
git commit -m "feat: make video studio private"
```

## Task 6: Document Bootstrap, Verify End To End, And Prepare Controlled Fixture Activation

**Files:**
- Modify: `docs/operations/07-marketing-ops/video-agent-studio.md`
- Modify: `docs/operations/07-marketing-ops/video-agent-production-worker.md`
- Modify: `.env.example`
- Test: `tests/video-studio-e2e.test.mjs`
- Test: `tests/video-worker-e2e.test.mjs`

**Interfaces:**
- Consumes the deployed Supabase schema, private Studio route, and signed worker client.
- Produces a repeatable, non-paid fixture activation runbook for the operator.

- [ ] **Step 1: Add a failing documentation contract test**

Add assertions that the Studio runbook requires all configuration, RLS tests, operator bootstrap, kill-switch verification, one fixture job, asset/export verification, and re-enabling the kill switch:

```js
for (const required of [
  "SUPABASE_URL",
  "STUDIO_WORKER_SHARED_SECRET",
  "STUDIO_OUTBOUND_KILL_SWITCH=true",
  "npx supabase db push",
  "fixture",
  "do not enable a paid provider",
]) assert.match(runbook, new RegExp(required.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&"), "i"));
```

- [ ] **Step 2: Run the contract test to verify the runbook is incomplete**

Run: `node --test tests/video-studio-e2e.test.mjs`

Expected: FAIL until the new deployment/activation constraints are documented.

- [ ] **Step 3: Document the exact bootstrap and activation sequence**

Document this order without storing secrets in Git:

1. Create staging and production Supabase projects, enable daily backups, and add `${STUDIO_APP_URL}/studio/auth/callback` to auth redirect URLs.
2. Run `npx supabase link --project-ref <project-ref>` and `npx supabase db push` from a protected operator machine.
3. Create the operator through magic link, then insert one `video_studio.tenants` row and one `video_studio.memberships` `operator` row using the service role/admin SQL console.
4. Put application and worker secrets only in server/VPS environment managers; set both kill switches true.
5. Deploy the private application and worker with the worker still bound to localhost/private TLS.
6. Authenticate, create/approve one fixture campaign, temporarily set the application and worker kill switches false, submit exactly one job, and verify its three post-production exports plus audit events.
7. Restore both kill switches to true and record the successful fixture acceptance result before any real provider configuration.

Add sanitized failure recovery and secret rotation notes. State clearly that neither paid generation nor social publishing is enabled by this release.

- [ ] **Step 4: Run the complete local verification suite**

Run:

```bash
npm install
npx supabase db reset
npm run test:studio-db
node --test tests/*.test.mjs
npm run lint
npm run build
docker build --quiet --tag giventake-video-worker:persistence-verify services/video-worker
cd services/video-worker
$env:STUDIO_WORKER_ENV_FILE='.env.example'; docker compose config --quiet
```

Expected: all database, domain, worker, lint, and build checks pass. Existing Vite font-resolution messages and the `vite-tsconfig-paths` deprecation notice may remain warnings only.

- [ ] **Step 5: Run the accessibility pass and restore generated fixtures**

Run:

```bash
npm run dev -- --port 8086
py -3.12 tests/a11y/consent_a11y.py http://localhost:8086
git restore --source=HEAD -- tests/a11y/screenshots/1_banner.png tests/a11y/screenshots/2_dialog.png
```

Expected: 20/20 accessibility checks pass and only intentional source/documentation changes remain.

- [ ] **Step 6: Commit documentation and verification changes**

```bash
git add .env.example docs/operations/07-marketing-ops tests/video-studio-e2e.test.mjs
git commit -m "docs: add studio fixture activation runbook"
```

## Plan Self-Review

- Spec coverage: Tasks 1-5 implement private auth, tenant RLS, durable data, async persistence, tenant injection, signed worker submission, default deny, and controlled fixture-only rendering. Task 6 implements bootstrap, recovery, and verification documentation. Paid providers, object storage, distribution, avatar, UGC, and ad spend remain explicitly out of scope.
- Placeholder scan: no unresolved implementation placeholders are present; all environment values, commands, file boundaries, policy behavior, test inputs, and commit points are specified.
- Type consistency: Task 2 defines `RenderJobRecord`, `createProviderPolicy`, and `buildProductionRenderJob`; Task 4 consumes them. Task 3 defines `requireStudioIdentity`/`requireStudioRole`; Tasks 4 and 5 consume them. Task 1 creates the schema/types backing the Supabase repository in Task 4.
