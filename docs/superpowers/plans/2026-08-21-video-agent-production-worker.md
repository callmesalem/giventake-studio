# Video Agent Production Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a signed, durable VPS video-worker foundation that safely renders approved fixture jobs into branded export manifests.

**Architecture:** Keep worker-safe contracts in `src/lib/studio` so the TanStack application can create signed job payloads without bundling Node worker code. Build an independent Node service in `services/video-worker` with a SQLite lease queue, fixture provider, FFmpeg planning/execution boundary, technical QA, and a localhost-only Docker deployment. Real provider activation remains off by default.

**Tech Stack:** TypeScript, Zod, Node 22+, built-in `node:sqlite`, built-in `node:http`, Node crypto, FFmpeg/FFprobe, Docker Compose, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-21-video-agent-production-worker-design.md`

## Global Constraints

- Worker queue requests require an HMAC-SHA256 signature, timestamp within five minutes, and unique request ID.
- Provider, storage, worker, and FFmpeg secrets must never enter browser code, committed configuration, or persisted diagnostics.
- `STUDIO_OUTBOUND_KILL_SWITCH=true` and the `fixture` provider remain defaults.
- Real provider submission requires a positive cost reservation and must fail before submission if it exceeds `budgetCents`.
- FFmpeg commands must be argument arrays passed to `spawn`, never shell command strings.
- Jobs never create edit approval, handoff, publishing, or advertising spend.
- The public Studio route remains local-only until the authentication and Postgres release.

---

### Task 1: Define Signed Production Render Contracts

**Files:**
- Create: `src/lib/studio/render-job.ts`
- Modify: `src/lib/studio/provider.ts`
- Modify: `src/lib/studio/sora-provider.ts`
- Test: `tests/video-worker-contracts.test.mjs`
- Test: `tests/video-studio-sora-provider.test.mjs`

**Interfaces:**
- Produces `productionRenderJobSchema`, `workerSignatureHeadersSchema`, `ProviderPollResult`, `ProviderCostPolicy`, `createWorkerSignature`, `verifyWorkerSignature`, and `createCostPolicy`.
- Changes `VideoProvider.poll(providerRequestId)` to return `ProviderPollResult` with `state: "pending" | "completed" | "failed" | "cancelled"`.
- Produces `createSoraVideoProvider(options)` that represents queued/in-progress Sora work as `pending` rather than throwing.

- [ ] **Step 1: Write failing contract tests**

```js
const signed = createWorkerSignature(job, "worker-secret", "2026-08-21T12:00:00.000Z", "request-1");
assert.equal(verifyWorkerSignature(job, signed, "worker-secret", new Date("2026-08-21T12:01:00.000Z")), true);
assert.equal(verifyWorkerSignature(job, signed, "wrong-secret", new Date("2026-08-21T12:01:00.000Z")), false);
assert.throws(() => createCostPolicy({ sora: { "sora-2": 35 } }).reserve(job), /budget/i);
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `node tests/video-worker-contracts.test.mjs`

Expected: FAIL because `render-job.ts` does not exist.

- [ ] **Step 3: Add schemas, canonical signature generation, clock-skew checks, and cost reservation**

```ts
export type ProviderPollResult =
  | { state: "pending"; retryAfterMs: number }
  | { state: "completed"; result: VideoGenerationResult }
  | { state: "failed"; category: "provider_rejected" | "provider_failed"; retryable: boolean }
  | { state: "cancelled" };

export function createWorkerSignature(body: ProductionRenderJob, secret: string, timestamp: string, requestId: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${requestId}.${stableJson(body)}`).digest("hex");
}
```

- [ ] **Step 4: Normalize the Sora adapter and extend its test**

```ts
if (video.status === "completed") return { state: "completed", result: { providerRequestId, assetUrl, durationSeconds, costCents: 0 } };
if (video.status === "failed") return { state: "failed", category: "provider_failed", retryable: false };
return { state: "pending", retryAfterMs: 15_000 };
```

- [ ] **Step 5: Run the focused tests**

Run: `node tests/video-worker-contracts.test.mjs; node tests/video-studio-sora-provider.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the shared contract**

```bash
git add src/lib/studio/render-job.ts src/lib/studio/provider.ts src/lib/studio/sora-provider.ts tests/video-worker-contracts.test.mjs tests/video-studio-sora-provider.test.mjs
git commit -m "feat: add signed video worker contracts"
```

### Task 2: Add Server-only Worker Client

**Files:**
- Create: `src/lib/studio/production-worker-client.ts`
- Test: `tests/video-worker-client.test.mjs`

**Interfaces:**
- Consumes `ProductionRenderJob` and signing helpers from `render-job.ts`.
- Produces `createProductionWorkerClient(options)` with `enqueue(job)` and `getStatus(jobId, tenantId)`.
- Every request sets `x-studio-timestamp`, `x-studio-request-id`, and `x-studio-signature`; server errors expose only status and a sanitized category.

- [ ] **Step 1: Write a failing client test**

```js
const client = createProductionWorkerClient({ baseUrl: "http://worker.internal", sharedSecret: "secret", fetch: fakeFetch });
await client.enqueue(job);
assert.equal(calls[0].headers.get("x-studio-signature").length, 64);
assert.match(calls[0].headers.get("content-type"), /application\/json/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/video-worker-client.test.mjs`

Expected: FAIL because the client module does not exist.

- [ ] **Step 3: Implement the signed HTTP client**

```ts
const response = await fetcher(`${baseUrl}/v1/jobs`, {
  method: "POST",
  headers: signedHeaders(job, sharedSecret, requestId, now),
  body: JSON.stringify(job),
});
if (!response.ok) throw new Error(`Video worker rejected job: ${response.status}.`);
```

- [ ] **Step 4: Run the focused test**

Run: `node tests/video-worker-client.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the application client**

```bash
git add src/lib/studio/production-worker-client.ts tests/video-worker-client.test.mjs
git commit -m "feat: add signed production worker client"
```

### Task 3: Create SQLite Lease Queue and Worker HTTP Service

**Files:**
- Create: `services/video-worker/package.json`
- Create: `services/video-worker/src/config.mjs`
- Create: `services/video-worker/src/repository.mjs`
- Create: `services/video-worker/src/http-server.mjs`
- Create: `services/video-worker/src/index.mjs`
- Test: `tests/video-worker-repository.test.mjs`
- Test: `tests/video-worker-http.test.mjs`

**Interfaces:**
- Produces `createWorkerRepository({ databasePath, now })` with `enqueue`, `get`, `claimNext`, `recordAttempt`, `complete`, `fail`, `markQaFailed`, and `queueCounts`.
- Produces `createWorkerHttpServer({ config, repository, now })` with `listen` and `close`.
- Queue states are `queued`, `leased`, `submitting`, `waiting_for_provider`, `assembling`, `qa_failed`, `completed`, `failed`, and `cancelled`.

- [ ] **Step 1: Write failing queue and HTTP tests**

```js
const claimed = repository.claimNext("worker-a", new Date("2026-08-21T12:00:00.000Z"));
assert.equal(claimed.status, "leased");
assert.equal(repository.claimNext("worker-b", new Date("2026-08-21T12:00:01.000Z")), null);
assert.equal(repository.claimNext("worker-b", new Date("2026-08-21T12:06:00.000Z")).id, claimed.id);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/video-worker-repository.test.mjs; node tests/video-worker-http.test.mjs`

Expected: FAIL because worker service modules do not exist.

- [ ] **Step 3: Implement the schema, lease recovery, request replay prevention, and health endpoint**

```js
db.exec(`CREATE TABLE IF NOT EXISTS jobs (...); CREATE TABLE IF NOT EXISTS attempts (...); CREATE TABLE IF NOT EXISTS requests (...);`);
const leaseUntil = new Date(now.getTime() + config.leaseMs).toISOString();
update.run("leased", workerId, leaseUntil, now.toISOString(), job.id);
```

- [ ] **Step 4: Implement signed HTTP enqueue/status handlers**

```js
if (!verifyWorkerSignature(body, headers, config.sharedSecret, now)) return json(response, 401, { error: "invalid_signature" });
if (repository.hasRequest(headers.requestId)) return json(response, 409, { error: "replayed_request" });
```

- [ ] **Step 5: Run the focused tests**

Run: `node tests/video-worker-repository.test.mjs; node tests/video-worker-http.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the durable queue service**

```bash
git add services/video-worker tests/video-worker-repository.test.mjs tests/video-worker-http.test.mjs
git commit -m "feat: add durable video worker queue"
```

### Task 4: Implement Provider Scheduling and Spend Enforcement

**Files:**
- Create: `services/video-worker/src/providers.mjs`
- Create: `services/video-worker/src/scheduler.mjs`
- Test: `tests/video-worker-scheduler.test.mjs`

**Interfaces:**
- Consumes claimed jobs from `repository.mjs`, `ProviderPollResult`, and the cost policy fields in each validated job.
- Produces `createScheduler({ repository, providers, downloader, clock })` with `runOnce(workerId)`.
- `runOnce` reserves total scene cost before submit; it retries only retryable failures and never exceeds three total attempts.

- [ ] **Step 1: Write a failing scheduler test**

```js
await scheduler.runOnce("worker-a");
assert.equal(provider.submitCalls, 0);
assert.equal(repository.get(job.id).status, "failed");
assert.match(repository.getAttempts(job.id).at(-1).category, /budget_exceeded/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/video-worker-scheduler.test.mjs`

Expected: FAIL because the scheduler module does not exist.

- [ ] **Step 3: Add fixture provider registry and scheduler state handling**

```js
if (poll.state === "pending") return repository.waitForProvider(job.id, poll.retryAfterMs, clock.now());
if (poll.state === "failed" && poll.retryable && attemptCount < 3) return repository.requeue(job.id, clock.now());
if (poll.state === "failed") return repository.fail(job.id, poll.category, clock.now());
```

- [ ] **Step 4: Add budget reservation before `provider.submit`**

```js
const reserved = scenes.reduce((sum, scene) => sum + job.costCentsPerSecond * scene.durationSeconds, 0);
if (reserved > job.budgetCents) return repository.fail(job.id, "budget_exceeded", clock.now());
```

- [ ] **Step 5: Run the focused test**

Run: `node tests/video-worker-scheduler.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit scheduling controls**

```bash
git add services/video-worker/src/providers.mjs services/video-worker/src/scheduler.mjs tests/video-worker-scheduler.test.mjs
git commit -m "feat: add video worker scheduling controls"
```

### Task 5: Add Deterministic FFmpeg Assembly and Probe QA

**Files:**
- Create: `services/video-worker/src/post-production.mjs`
- Create: `services/video-worker/src/ffmpeg.mjs`
- Create: `services/video-worker/src/qa.mjs`
- Test: `tests/video-worker-post-production.test.mjs`
- Test: `tests/video-worker-qa.test.mjs`

**Interfaces:**
- Produces `createAssemblyPlan(job, profile, inputPaths, outputPath)` and exactly three platform profiles.
- Produces `createFfmpegRunner({ ffmpegPath, ffprobePath, spawn })` with `run(plan)` and `probe(path)`.
- Produces `validateExport(probe, expected)` returning `{ passed, findings }`.

- [ ] **Step 1: Write failing post-production and QA tests**

```js
const plan = createAssemblyPlan(job, "vertical", ["scene-1.mp4", "scene-2.mp4", "scene-3.mp4"], "vertical.mp4");
assert.equal(plan.width, 1080);
assert.equal(plan.height, 1920);
assert.ok(plan.args.includes("-filter_complex"));
assert.match(plan.filterGraph, /subtitles=/);
assert.equal(validateExport({ width: 1080, height: 1920, durationSeconds: 20, hasVideo: true }, plan).passed, true);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/video-worker-post-production.test.mjs; node tests/video-worker-qa.test.mjs`

Expected: FAIL because the post-production modules do not exist.

- [ ] **Step 3: Implement safe subtitle/overlay files and argument-array FFmpeg plans**

```js
return {
  profile,
  width: profile.width,
  height: profile.height,
  expectedDurationSeconds,
  args: ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-filter_complex", filterGraph, "-map", "[video]", "-map", "0:a?", "-c:v", "libx264", outputPath],
};
```

- [ ] **Step 4: Implement FFprobe normalization and objective QA failures**

```js
const durationDelta = Math.abs(probe.durationSeconds - expectedDurationSeconds);
if (durationDelta > 0.75) findings.push({ code: "duration_mismatch", severity: "error" });
if (!probe.hasVideo || probe.width !== width || probe.height !== height) findings.push({ code: "video_profile_mismatch", severity: "error" });
```

- [ ] **Step 5: Run focused tests**

Run: `node tests/video-worker-post-production.test.mjs; node tests/video-worker-qa.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit deterministic post-production**

```bash
git add services/video-worker/src/post-production.mjs services/video-worker/src/ffmpeg.mjs services/video-worker/src/qa.mjs tests/video-worker-post-production.test.mjs tests/video-worker-qa.test.mjs
git commit -m "feat: add deterministic video post-production"
```

### Task 6: Wire Fixture End-to-End Service and VPS Packaging

**Files:**
- Modify: `services/video-worker/src/index.mjs`
- Create: `services/video-worker/Dockerfile`
- Create: `services/video-worker/docker-compose.yml`
- Create: `services/video-worker/.env.example`
- Create: `docs/operations/07-marketing-ops/video-agent-production-worker.md`
- Test: `tests/video-worker-e2e.test.mjs`

**Interfaces:**
- Wires `createWorkerHttpServer`, `createScheduler`, `createFfmpegRunner`, and `validateExport` into one process.
- Produces `npm run start` and `npm run test` inside the worker package.
- Provides Docker Compose environment defaults: `STUDIO_VIDEO_PROVIDER=fixture`, `STUDIO_OUTBOUND_KILL_SWITCH=true`, `STUDIO_WORKER_PORT=8788`, and a persistent `/var/lib/giventake-video-worker` volume.

- [ ] **Step 1: Write a failing fixture end-to-end test**

```js
const response = await signedPost(server.url, job, secret);
assert.equal(response.status, 202);
await scheduler.runUntilIdle("worker-a");
assert.equal(repository.get(job.id).status, "completed");
assert.deepEqual(repository.getExports(job.id).map((item) => item.profile), ["vertical", "square", "landscape"]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/video-worker-e2e.test.mjs`

Expected: FAIL because service components are not wired together.

- [ ] **Step 3: Wire the worker process and build localhost-only Docker packaging**

```dockerfile
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 10001 studio
USER studio
CMD ["node", "src/index.mjs"]
```

- [ ] **Step 4: Write the operator runbook and fixture-only smoke command**

```bash
cd services/video-worker
cp .env.example .env
docker compose up --build
curl http://127.0.0.1:8788/healthz
```

- [ ] **Step 5: Run end-to-end, lint, app build, and diff checks**

Run: `node tests/video-worker-e2e.test.mjs; npm run lint; npm run build; git diff --check`

Expected: PASS.

- [ ] **Step 6: Commit the runnable worker release**

```bash
git add services/video-worker docs/operations/07-marketing-ops/video-agent-production-worker.md tests/video-worker-e2e.test.mjs
git commit -m "feat: package production video worker"
```

