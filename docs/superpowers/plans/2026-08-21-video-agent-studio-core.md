# GivenTake Video Agent Studio Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private, local-first Video Agent Studio that converts a campaign brief into an approved fixture-rendered export package with tenant-safe audit history.

**Architecture:** Add a self-contained Studio domain to the existing TanStack Start application. Server routes use typed Zod contracts and a deterministic JSON development repository; a fixture worker simulates a provider so the full approval-to-export flow works with no paid APIs. The domain contracts intentionally match the later VPS worker and PostgreSQL persistence boundary.

**Tech Stack:** TypeScript, React 19, TanStack Start/Router, Zod, Tailwind CSS, Node test runner, deterministic JSON file persistence.

**Spec:** `docs/superpowers/specs/2026-08-21-giventake-video-agent-studio-design.md`

## Global Constraints

- All Studio records must carry `tenantId` and reject cross-tenant access.
- Provider secrets must never be added to browser code, test fixtures, source control, or errors.
- Generation requires an explicit storyboard approval and a budget ceiling.
- Handoff requires an explicit edit approval.
- The fixture provider is the only provider enabled by default.
- The UI must remain private-by-default and use no external font, analytics, or provider call.
- Public marketing routes must retain their existing behavior and tests.

---

### Task 1: Establish Studio Domain Contracts

**Files:**
- Create: `src/lib/studio/types.ts`
- Create: `src/lib/studio/schema.ts`
- Create: `src/lib/studio/state-machine.ts`
- Test: `tests/video-studio-domain.test.mjs`

**Interfaces:**
- Produces `CampaignStatus`, `CampaignBrief`, `StoryboardScene`, `CampaignRecord`, `ApprovalRecord`, `AuditEvent`, `ExportRecord`, and `StudioRepository` types.
- Produces `createCampaignInputSchema`, `approveStoryboardInputSchema`, `approveEditInputSchema`, and `handoffInputSchema`.
- Produces `assertTransition(from, to): void` and `isHumanApprovalTransition(from, to): boolean`.

- [ ] **Step 1: Write the failing contract tests**

```js
import assert from "node:assert/strict";
import { createCampaignInputSchema } from "../src/lib/studio/schema.ts";
import { assertTransition } from "../src/lib/studio/state-machine.ts";

assert.equal(createCampaignInputSchema.safeParse({ tenantId: "gt-devs", name: "Launch", goal: "Leads", offer: "AI automation", audience: "Owners", callToAction: "Book", budgetCents: 2500 }).success, true);
assert.throws(() => assertTransition("draft", "approved_for_generation"));
assert.doesNotThrow(() => assertTransition("awaiting_storyboard_approval", "approved_for_generation"));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-studio-domain.test.mjs`

Expected: FAIL because Studio domain modules do not exist.

- [ ] **Step 3: Add Zod schemas, typed records, and legal campaign transitions**

```ts
export const campaignStatuses = [
  "draft", "planned", "awaiting_storyboard_approval", "approved_for_generation",
  "rendering", "awaiting_edit_approval", "exported", "handed_off", "archived", "failed",
] as const;

export function assertTransition(from: CampaignStatus, to: CampaignStatus) {
  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`Invalid campaign transition: ${from} -> ${to}`);
  }
}
```

- [ ] **Step 4: Run the domain test**

Run: `node --experimental-strip-types tests/video-studio-domain.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the contract foundation**

```bash
git add src/lib/studio/types.ts src/lib/studio/schema.ts src/lib/studio/state-machine.ts tests/video-studio-domain.test.mjs
git commit -m "feat: add video studio domain contracts"
```

### Task 2: Add Tenant-safe Development Persistence And Audit Events

**Files:**
- Create: `src/lib/studio/repository.ts`
- Create: `src/lib/studio/fixture-data.ts`
- Test: `tests/video-studio-repository.test.mjs`

**Interfaces:**
- Consumes `CampaignRecord`, `ApprovalRecord`, `AuditEvent`, and `ExportRecord` from `types.ts`.
- Produces `createStudioRepository(seed?): StudioRepository` with `createCampaign`, `getCampaign`, `listCampaigns`, `saveCampaign`, `addApproval`, `addAuditEvent`, and `listAuditEvents` methods.
- Every read and write accepts `tenantId` and returns only records for that tenant.

- [ ] **Step 1: Write a failing tenant isolation test**

```js
const repo = createStudioRepository();
const created = repo.createCampaign({ tenantId: "tenant-a", name: "A", goal: "Leads", offer: "Offer", audience: "Owners", callToAction: "Book", budgetCents: 2500 }, "operator-1");
assert.equal(repo.getCampaign("tenant-a", created.id)?.name, "A");
assert.equal(repo.getCampaign("tenant-b", created.id), null);
assert.equal(repo.listCampaigns("tenant-b").length, 0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-studio-repository.test.mjs`

Expected: FAIL because `createStudioRepository` does not exist.

- [ ] **Step 3: Implement the deterministic in-memory repository and append-only audit records**

```ts
getCampaign(tenantId: string, campaignId: string) {
  const campaign = campaigns.get(campaignId);
  return campaign?.tenantId === tenantId ? structuredClone(campaign) : null;
}
```

- [ ] **Step 4: Run the repository test**

Run: `node --experimental-strip-types tests/video-studio-repository.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the repository**

```bash
git add src/lib/studio/repository.ts src/lib/studio/fixture-data.ts tests/video-studio-repository.test.mjs
git commit -m "feat: add tenant-safe studio repository"
```

### Task 3: Build Campaign Planning And Approval Service

**Files:**
- Create: `src/lib/studio/service.ts`
- Test: `tests/video-studio-service.test.mjs`

**Interfaces:**
- Consumes `StudioRepository` and input schemas.
- Produces `createStudioService(repository)` with `createCampaign`, `planCampaign`, `approveStoryboard`, `queueRender`, `approveEdit`, and `handoffExport` methods.
- `planCampaign` creates a versioned brief and three timed scenes without calling an LLM.
- `queueRender` fails unless the current revision has a storyboard approval and the recorded budget is positive.

- [ ] **Step 1: Write failing approval-gate tests**

```js
const service = createStudioService(createStudioRepository());
const campaign = service.createCampaign(input, "operator-1");
service.planCampaign("gt-devs", campaign.id, "operator-1");
assert.throws(() => service.queueRender("gt-devs", campaign.id, "operator-1"), /storyboard approval/i);
service.approveStoryboard("gt-devs", campaign.id, "operator-1");
assert.equal(service.queueRender("gt-devs", campaign.id, "operator-1").status, "rendering");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-studio-service.test.mjs`

Expected: FAIL because `createStudioService` does not exist.

- [ ] **Step 3: Implement deterministic planning, immutable revision snapshots, state transitions, and audit events**

```ts
function makeStoryboard(brief: CampaignBrief): StoryboardScene[] {
  return [
    { order: 1, durationSeconds: 5, purpose: "hook", narration: brief.goal, prompt: "Premium cinematic service-business opening shot", safeArea: "bottom" },
    { order: 2, durationSeconds: 10, purpose: "proof", narration: brief.offer, prompt: "Clear product and workflow moment", safeArea: "bottom" },
    { order: 3, durationSeconds: 5, purpose: "cta", narration: brief.callToAction, prompt: "Calm final visual with clear CTA safe area", safeArea: "center" },
  ];
}
```

- [ ] **Step 4: Run the service test**

Run: `node --experimental-strip-types tests/video-studio-service.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the campaign service**

```bash
git add src/lib/studio/service.ts tests/video-studio-service.test.mjs
git commit -m "feat: add studio campaign approval service"
```

### Task 4: Add Fixture Worker And Export Manifest

**Files:**
- Create: `src/lib/studio/provider.ts`
- Create: `src/lib/studio/fixture-provider.ts`
- Create: `src/lib/studio/worker.ts`
- Test: `tests/video-studio-worker.test.mjs`

**Interfaces:**
- Produces `VideoProvider` interface with `estimate`, `submit`, `poll`, and `cancel` methods.
- Produces `createFixtureProvider()` and `runFixtureWorker(repository, tenantId, actorId): ExportRecord[]`.
- The worker transitions a queued campaign from `rendering` to `awaiting_edit_approval`, creates scene assets, QA findings, and three export manifests.

- [ ] **Step 1: Write a failing fixture-render workflow test**

```js
service.approveStoryboard("gt-devs", campaign.id, "operator-1");
service.queueRender("gt-devs", campaign.id, "operator-1");
const exports = runFixtureWorker(repo, "gt-devs", "worker-fixture");
assert.equal(exports.length, 3);
assert.deepEqual(exports.map((item) => item.profile), ["vertical", "square", "landscape"]);
assert.equal(repo.getCampaign("gt-devs", campaign.id)?.status, "awaiting_edit_approval");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-studio-worker.test.mjs`

Expected: FAIL because fixture provider and worker modules do not exist.

- [ ] **Step 3: Implement the provider boundary, fixture render attempts, technical QA, and platform manifest records**

```ts
export const exportProfiles = {
  vertical: { width: 1080, height: 1920, aspectRatio: "9:16" },
  square: { width: 1080, height: 1080, aspectRatio: "1:1" },
  landscape: { width: 1920, height: 1080, aspectRatio: "16:9" },
} as const;
```

- [ ] **Step 4: Run the worker test**

Run: `node --experimental-strip-types tests/video-studio-worker.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the fixture worker**

```bash
git add src/lib/studio/provider.ts src/lib/studio/fixture-provider.ts src/lib/studio/worker.ts tests/video-studio-worker.test.mjs
git commit -m "feat: add fixture video render worker"
```

### Task 5: Add Server-only Studio Actions

**Files:**
- Create: `src/lib/studio/actions.ts`
- Create: `src/lib/studio/server.ts`
- Test: `tests/video-studio-api.test.mjs`

**Interfaces:**
- Consumes `StudioService` and Zod inputs.
- Produces CSRF-protected TanStack Start server functions that accept a development identity object, then call a single server-only `StudioService` instance.
- Rejects missing identity, cross-tenant campaign IDs, invalid state, and malformed input with explicit safe errors.

- [ ] **Step 1: Write a failing route-contract test**

```js
const { createStudioCampaign } = await vite.ssrLoadModule("/src/lib/studio/actions.ts");
await assert.rejects(() => createStudioCampaign({ data: { input } }), /identity/i);
const created = await createStudioCampaign({ data: { identity, input } });
assert.equal(created.status, "draft");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/video-studio-api.test.mjs`

Expected: FAIL because Studio server actions do not exist.

- [ ] **Step 3: Implement server-only Studio singleton, identity extraction, validation, and typed JSON responses**

```ts
export const createStudioCampaign = createServerFn({ method: "POST" })
  .validator((data: unknown) => createStudioCampaignActionSchema.parse(data))
  .handler(({ data }) => getStudioService().createCampaign(data.input, data.identity.actorId));
```

- [ ] **Step 4: Run the API route test**

Run: `node tests/video-studio-api.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the Studio API**

```bash
git add src/lib/studio/actions.ts src/lib/studio/server.ts tests/video-studio-api.test.mjs
git commit -m "feat: add private studio actions"
```

### Task 6: Build The Studio Dashboard

**Files:**
- Create: `src/routes/studio.tsx`
- Create: `src/components/studio/campaign-form.tsx`
- Create: `src/components/studio/campaign-list.tsx`
- Create: `src/components/studio/storyboard-panel.tsx`
- Create: `src/components/studio/approval-panel.tsx`
- Create: `src/components/studio/export-panel.tsx`
- Modify: `src/router.tsx`
- Test: `tests/video-studio-ui.test.mjs`

**Interfaces:**
- Consumes Studio server functions and displays only data from the selected tenant.
- Produces a campaign form, campaign list, planned storyboard, approval controls, render action, and export/handoff state.
- All irreversible actions include a confirmation dialog and display the current recorded budget.

- [ ] **Step 1: Write a failing UI smoke test**

```js
const html = read("src/routes/studio.tsx");
assert(html.includes("Video Agent Studio"));
assert(html.includes("Approve storyboard"));
assert(html.includes("Approve edit"));
assert(html.includes("createStudioCampaign"));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/video-studio-ui.test.mjs`

Expected: FAIL because Studio UI modules do not exist.

- [ ] **Step 3: Implement the responsive Studio route and focused components**

```tsx
<main className="min-h-screen bg-white text-zinc-950">
  <header className="border-b border-zinc-200">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
      <h1 className="text-2xl font-semibold">Video Agent Studio</h1>
      <span className="text-sm text-zinc-600">GivenTake Devs</span>
    </div>
  </header>
</main>
```

- [ ] **Step 4: Run the UI test and production build**

Run: `node tests/video-studio-ui.test.mjs && npm run build`

Expected: PASS and a successful Vite build.

- [ ] **Step 5: Commit the dashboard**

```bash
git add src/routes/studio.tsx src/components/studio src/router.tsx tests/video-studio-ui.test.mjs src/routeTree.gen.ts
git commit -m "feat: add video agent studio dashboard"
```

### Task 7: Verify The Core Workflow And Document Configuration

**Files:**
- Modify: `.env.example`
- Create: `docs/operations/07-marketing-ops/video-agent-studio.md`
- Create: `tests/video-studio-e2e.test.mjs`

**Interfaces:**
- Runs the complete fixture workflow: create, plan, approve storyboard, render, approve edit, hand off.
- Documents required VPS and provider variables without placing values in source.

- [ ] **Step 1: Write the full workflow test**

```js
const campaign = service.createCampaign(input, "operator-1");
service.planCampaign("gt-devs", campaign.id, "operator-1");
service.approveStoryboard("gt-devs", campaign.id, "operator-1");
service.queueRender("gt-devs", campaign.id, "operator-1");
runFixtureWorker(repo, "gt-devs", "worker-fixture");
service.approveEdit("gt-devs", campaign.id, "operator-1");
assert.equal(service.handoffExport("gt-devs", campaign.id, "operator-1").status, "handed_off");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-studio-e2e.test.mjs`

Expected: FAIL until all workflow transitions are complete.

- [ ] **Step 3: Add the remaining transitions, environment names, kill-switch behavior, and operator runbook**

```dotenv
STUDIO_WORKER_SHARED_SECRET=
STUDIO_STORAGE_BUCKET=
STUDIO_STORAGE_ENDPOINT=
STUDIO_STORAGE_ACCESS_KEY=
STUDIO_STORAGE_SECRET_KEY=
STUDIO_VIDEO_PROVIDER=fixture
STUDIO_VIDEO_PROVIDER_API_KEY=
STUDIO_COMFYUI_ENDPOINT=
STUDIO_OUTBOUND_KILL_SWITCH=true
```

- [ ] **Step 4: Run the full test suite and build**

Run: `node --experimental-strip-types tests/video-studio-domain.test.mjs && node --experimental-strip-types tests/video-studio-repository.test.mjs && node --experimental-strip-types tests/video-studio-service.test.mjs && node --experimental-strip-types tests/video-studio-worker.test.mjs && node --experimental-strip-types tests/video-studio-e2e.test.mjs && npm run lint && npm run build && node tests/compliance-tracking.test.mjs && node tests/customer-1-pipeline.test.mjs && node tests/customer-1-behavior.test.mjs && node tests/launch-identity.test.mjs`

Expected: every command exits with status 0.

- [ ] **Step 5: Commit the verified core release**

```bash
git add .env.example docs/operations/07-marketing-ops/video-agent-studio.md tests/video-studio-e2e.test.mjs
git commit -m "docs: add video studio operating runbook"
```
