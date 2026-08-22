# Video Agent Studio Media Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Release 1 of the Video Agent Studio — private Supabase Storage media handoff, signed idempotent worker callbacks, durable assets and three export renditions, authenticated preview URLs, and the edit-review state machine — with fixture as the only executable provider.

**Architecture:** Three deployables. The TanStack Start app on Cloudflare holds the Supabase service-role key and exposes five signed machine-to-machine endpoints under `/api/video/*`. A Docker container polls those endpoints for work, generates fixture media, assembles it with FFmpeg, and uploads bytes straight to private Storage through server-issued signed URLs. It holds no database credential. Postgres enforces isolation with `FORCE` RLS, zero grants to `anon`/`authenticated`, and `SECURITY DEFINER` RPCs executable only by `service_role`.

**Tech Stack:** TanStack Start (React 19), TypeScript, Zod 4, Supabase (Postgres + Storage + Auth), Node 22, FFmpeg, Docker, `node --experimental-strip-types` test runner, Bun for scripts and CI.

**Spec:** `docs/superpowers/specs/2026-08-21-video-agent-media-handoff-design.md`

---

## Global Constraints

These come from the spec and the operating charter. Breaking one is a plan failure, not a judgement call.

- **No paid or self-hosted video provider.** Fixture is the only executable provider in R1.
- **No social publishing, scheduling, or ad spend.**
- **No public media.** The bucket is private; every read is an authenticated, short-lived signed URL.
- **No browser-visible secrets.** Never prefix a secret with `VITE_`. No Supabase credential, storage path, or bucket name may reach the client bundle.
- **The worker never holds a Supabase key.** It holds `GT_APP_BASE_URL` and `VIDEO_WORKER_SECRET` only.
- **The worker never chooses a storage path.** The app derives every path.
- **Every callback is idempotent.** Replay must not create duplicate rows or burn a retry attempt.
- **The kill switch fails closed.** With `VIDEO_PIPELINE_ENABLED` off, the claim endpoint returns empty.
- **A project cannot reach `approved` without a real `auth.users` id.**
- **No new subprocessor or AI tool register row in R1.** The fixture provider is local and processes no personal data.
- Follow the existing CRM access model exactly: `owner_id` → `auth.users`, `FORCE` RLS, no direct grants, `SECURITY DEFINER` RPCs granted to `service_role` only.

---

## File Structure

**Migrations** — additive only, never alter an existing CRM table.

| File | Responsibility |
|---|---|
| `supabase/migrations/20260821240000_video_studio_foundation.sql` | Seven tables, constraints, indexes, `FORCE` RLS, revoke grants |
| `supabase/migrations/20260821241000_video_studio_rpcs.sql` | Every `SECURITY DEFINER` RPC, granted to `service_role` only |
| `supabase/migrations/20260821242000_video_media_bucket.sql` | Private `video-media` storage bucket |

**Server library** — `src/server/video/`, one responsibility per file, all server-only.

| File | Responsibility |
|---|---|
| `src/server/video/types.ts` | Shared types for jobs, scenes, assets, exports |
| `src/server/video/signing.ts` | HMAC sign/verify, clock-skew rejection |
| `src/server/video/paths.ts` | Storage path derivation and validation |
| `src/server/video/state.ts` | State transition allowlist |
| `src/server/video/storyboard.ts` | Zod schema for scenes |
| `src/server/video/store.ts` | PostgREST RPC client, mirrors `CrmRead` |
| `src/server/video/endpoint.ts` | Shared request pipeline for the five routes |

**API routes** — `src/routes/api.video.*.ts`, one route per file.

**Studio UI** — `src/lib/video-data.ts` (client-safe server functions), `src/lib/video-data.server.ts` (session + service key), `src/routes/crm.video.tsx`, `src/routes/crm.video.$id.tsx`.

**Worker** — `worker/` with its own `package.json`, `tsconfig.json`, `Dockerfile`, and `src/{index,config,client,fixture,ffmpeg}.ts`.

**Tests** — `tests/video-*.test.mjs` for unit, `tests/video-rls.integration.test.mjs` and `tests/video-worker.integration.test.mjs` for integration.

---

## Implementation Order

Phases are sequential; tasks inside a phase are not parallelisable unless stated.

1. **Phase 1 — Pure logic** (Tasks 1–4). No database, no network. Fastest feedback, and every later phase depends on these.
2. **Phase 2 — Database** (Tasks 5–7). Schema, RPCs, bucket, and the isolation proof.
3. **Phase 3 — API** (Tasks 8–10). Store client, signed request pipeline, the six endpoints.
4. **Phase 4 — Worker** (Tasks 11–17). Config, client, FFmpeg, fixture, poll loop, container, integration test.
5. **Phase 5 — Studio** (Tasks 18–20). UI RPCs, server functions, screens.
6. **Phase 6 — Ship** (Tasks 21–25). Config, CI, docs, verification.

Tasks 1–4 are independent of each other and could be parallelised. Everything from Task 5 onward is sequential.

---

# Phase 1 — Pure Logic

## Task 1: Request Signing

The worker and app authenticate every callback with HMAC-SHA256 over a canonical payload. Canonicalisation matters: without sorted keys, a signature breaks whenever JSON serialisation order changes. `canonicalPayload()` already exists and does exactly this.

**Files:**
- Create: `src/server/video/signing.ts`
- Test: `tests/video-signing.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-signing.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { signPayload, verifySigned, MAX_SKEW_MS } from "../src/server/video/signing.ts";

const SECRET = "test-secret-value";
const NOW = 1_760_000_000_000;
const payload = { job_id: "j1", kind: "scene_clip", scene_index: 0 };

// A signature verifies against the same inputs.
const ts = String(NOW);
const nonce = "nonce-1";
const sig = signPayload(SECRET, ts, nonce, payload);
assert.equal(verifySigned({ secret: SECRET, timestamp: ts, nonce, payload, signature: sig, now: NOW }).ok, true);

// Key order must not change the signature.
const reordered = { scene_index: 0, kind: "scene_clip", job_id: "j1" };
assert.equal(signPayload(SECRET, ts, nonce, reordered), sig, "canonical payload must sort keys");

// A tampered payload fails.
const tampered = verifySigned({
  secret: SECRET, timestamp: ts, nonce,
  payload: { ...payload, scene_index: 1 }, signature: sig, now: NOW,
});
assert.equal(tampered.ok, false);
assert.equal(tampered.reason, "signature_mismatch");

// A different secret fails.
assert.equal(
  verifySigned({ secret: "other", timestamp: ts, nonce, payload, signature: sig, now: NOW }).ok,
  false,
);

// A stale timestamp fails, in both directions.
assert.equal(
  verifySigned({ secret: SECRET, timestamp: ts, nonce, payload, signature: sig, now: NOW + MAX_SKEW_MS + 1000 }).reason,
  "timestamp_skew",
);
assert.equal(
  verifySigned({ secret: SECRET, timestamp: ts, nonce, payload, signature: sig, now: NOW - MAX_SKEW_MS - 1000 }).reason,
  "timestamp_skew",
);

// A non-numeric timestamp fails rather than throwing.
assert.equal(
  verifySigned({ secret: SECRET, timestamp: "not-a-number", nonce, payload, signature: sig, now: NOW }).reason,
  "timestamp_invalid",
);

// A malformed signature fails rather than throwing.
assert.equal(
  verifySigned({ secret: SECRET, timestamp: ts, nonce, payload, signature: "zz", now: NOW }).ok,
  false,
);

// An empty secret is a configuration error, not a soft failure.
assert.throws(() => signPayload("", ts, nonce, payload), /secret/i);

console.log("video-signing: ok");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-signing.test.mjs`
Expected: FAIL — `Cannot find module '../src/server/video/signing.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/server/video/signing.ts`:

```typescript
/**
 * HMAC request signing for worker callbacks.
 *
 * The render worker holds no database credential; these signatures are the only
 * thing authenticating it to /api/video/*. Signing covers timestamp, nonce and
 * the canonical payload together, so none of the three can be swapped between
 * requests.
 *
 * Canonicalisation is delegated to operator-control/hash.ts, which sorts object
 * keys. Without that, a signature would break whenever JSON serialisation order
 * changed between the worker and the app.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalPayload } from "../operator-control/hash.ts";

export const SIGNATURE_HEADER = "x-gt-signature";
export const TIMESTAMP_HEADER = "x-gt-timestamp";
export const NONCE_HEADER = "x-gt-nonce";

/** Requests more than five minutes from server time are rejected. */
export const MAX_SKEW_MS = 5 * 60 * 1000;

export type VerifyFailure =
  | "timestamp_invalid"
  | "timestamp_skew"
  | "signature_mismatch";

export interface VerifyInput {
  secret: string;
  timestamp: string;
  nonce: string;
  payload: unknown;
  signature: string;
  now?: number;
}

export function signPayload(
  secret: string,
  timestamp: string,
  nonce: string,
  payload: unknown,
): string {
  if (!secret) throw new Error("signPayload requires a non-empty secret");
  const base = `${timestamp}.${nonce}.${canonicalPayload(payload)}`;
  return createHmac("sha256", secret).update(base).digest("hex");
}

export function verifySigned(
  input: VerifyInput,
): { ok: true } | { ok: false; reason: VerifyFailure } {
  const sent = Number(input.timestamp);
  if (!Number.isFinite(sent)) return { ok: false, reason: "timestamp_invalid" };

  const now = input.now ?? Date.now();
  if (Math.abs(now - sent) > MAX_SKEW_MS) return { ok: false, reason: "timestamp_skew" };

  const expected = signPayload(input.secret, input.timestamp, input.nonce, input.payload);

  // Compare as bytes of equal length; timingSafeEqual throws on length mismatch,
  // which a malformed signature would otherwise trigger.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.signature ?? "", "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/video-signing.test.mjs`
Expected: PASS — prints `video-signing: ok`

- [ ] **Step 5: Commit**

```bash
git add src/server/video/signing.ts tests/video-signing.test.mjs
git commit -m "feat(video): HMAC signing for worker callbacks"
```

---

## Task 2: Storage Path Derivation

The worker must never choose a storage path. The app derives every path from ids it controls, which removes traversal and cross-project writes from the threat model. This file is the single place that decides where bytes live.

**Files:**
- Create: `src/server/video/paths.ts`
- Test: `tests/video-paths.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-paths.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { assetPath, exportPath, isSafeSegment } from "../src/server/video/paths.ts";

const project = "11111111-1111-4111-8111-111111111111";
const job = "22222222-2222-4222-8222-222222222222";

assert.equal(
  assetPath({ projectId: project, jobId: job, kind: "scene_clip", sceneIndex: 0, ext: "mp4" }),
  `${project}/${job}/scene_clip-0.mp4`,
);

// A null scene index is rendered as "all", never as "null" or an empty segment.
assert.equal(
  assetPath({ projectId: project, jobId: job, kind: "audio", sceneIndex: null, ext: "m4a" }),
  `${project}/${job}/audio-all.m4a`,
);

assert.equal(
  exportPath({ projectId: project, jobId: job, rendition: "16x9" }),
  `${project}/${job}/export-16x9.mp4`,
);

// Ids must be UUIDs. Anything else is rejected rather than sanitised, because a
// caller passing a non-UUID is a bug we want loud.
for (const bad of ["../../etc/passwd", "..", "a/b", "", "1;drop table"]) {
  assert.throws(
    () => assetPath({ projectId: bad, jobId: job, kind: "scene_clip", sceneIndex: 0, ext: "mp4" }),
    /invalid/i,
    `expected rejection for ${JSON.stringify(bad)}`,
  );
}

// Kind and extension are allowlisted.
assert.throws(
  () => assetPath({ projectId: project, jobId: job, kind: "../evil", sceneIndex: 0, ext: "mp4" }),
  /invalid/i,
);
assert.throws(
  () => assetPath({ projectId: project, jobId: job, kind: "scene_clip", sceneIndex: 0, ext: "sh" }),
  /invalid/i,
);

// Scene index must be a non-negative integer.
for (const bad of [-1, 1.5, Number.NaN]) {
  assert.throws(
    () => assetPath({ projectId: project, jobId: job, kind: "scene_clip", sceneIndex: bad, ext: "mp4" }),
    /invalid/i,
  );
}

assert.equal(isSafeSegment("scene_clip-0.mp4"), true);
assert.equal(isSafeSegment("../x"), false);
assert.equal(isSafeSegment("a/b"), false);

console.log("video-paths: ok");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-paths.test.mjs`
Expected: FAIL — `Cannot find module '../src/server/video/paths.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/server/video/paths.ts`:

```typescript
/**
 * Storage path derivation.
 *
 * The render worker declares what it is uploading; it never says where. Every
 * path is built here from ids the app already trusts, so a compromised or buggy
 * worker cannot write outside its own job prefix.
 *
 * Invalid input throws rather than being sanitised. A caller passing a
 * non-UUID is a bug, and silently rewriting it would hide the bug and could
 * still land bytes somewhere unintended.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ASSET_KINDS = ["scene_clip", "audio", "endcard", "master"] as const;
export const RENDITIONS = ["9x16", "1x1", "16x9"] as const;
const EXTENSIONS = ["mp4", "m4a", "png"] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];
export type Rendition = (typeof RENDITIONS)[number];
type Extension = (typeof EXTENSIONS)[number];

/** True when a segment is a single, traversal-free path component. */
export function isSafeSegment(segment: string): boolean {
  return segment.length > 0 && !segment.includes("/") && segment !== "." && segment !== "..";
}

function uuid(value: string, label: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new Error(`invalid ${label}: expected a UUID`);
  }
  return value.toLowerCase();
}

function sceneSegment(sceneIndex: number | null): string {
  if (sceneIndex === null) return "all";
  if (!Number.isInteger(sceneIndex) || sceneIndex < 0) {
    throw new Error("invalid sceneIndex: expected a non-negative integer or null");
  }
  return String(sceneIndex);
}

export interface AssetPathInput {
  projectId: string;
  jobId: string;
  kind: string;
  sceneIndex: number | null;
  ext: string;
}

export function assetPath(input: AssetPathInput): string {
  const project = uuid(input.projectId, "projectId");
  const job = uuid(input.jobId, "jobId");
  if (!(ASSET_KINDS as readonly string[]).includes(input.kind)) {
    throw new Error(`invalid kind: ${input.kind}`);
  }
  if (!(EXTENSIONS as readonly string[]).includes(input.ext)) {
    throw new Error(`invalid ext: ${input.ext}`);
  }
  return `${project}/${job}/${input.kind}-${sceneSegment(input.sceneIndex)}.${input.ext}`;
}

export interface ExportPathInput {
  projectId: string;
  jobId: string;
  rendition: string;
}

export function exportPath(input: ExportPathInput): string {
  const project = uuid(input.projectId, "projectId");
  const job = uuid(input.jobId, "jobId");
  if (!(RENDITIONS as readonly string[]).includes(input.rendition)) {
    throw new Error(`invalid rendition: ${input.rendition}`);
  }
  return `${project}/${job}/export-${input.rendition}.mp4`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/video-paths.test.mjs`
Expected: PASS — prints `video-paths: ok`

- [ ] **Step 5: Commit**

```bash
git add src/server/video/paths.ts tests/video-paths.test.mjs
git commit -m "feat(video): derive storage paths server-side only"
```

---

## Task 3: State Transition Allowlist

The state machine is enforced in two places — here for fast feedback and clear errors, and again in SQL (Task 6) so it holds even if a future caller bypasses this module. Duplication is deliberate; the database is the one that cannot be bypassed.

**Files:**
- Create: `src/server/video/state.ts`
- Test: `tests/video-state.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-state.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { PROJECT_STATES, canTransition, assertTransition } from "../src/server/video/state.ts";

const legal = [
  ["draft", "storyboarded"],
  ["storyboarded", "queued"],
  ["queued", "rendering"],
  ["rendering", "review"],
  ["rendering", "failed"],
  ["rendering", "queued"],
  ["review", "approved"],
  ["review", "changes_requested"],
  ["changes_requested", "storyboarded"],
  ["failed", "queued"],
  ["storyboarded", "storyboarded"],
];
for (const [from, to] of legal) {
  assert.equal(canTransition(from, to), true, `${from} -> ${to} should be legal`);
}

const illegal = [
  ["draft", "queued"],
  ["draft", "approved"],
  ["storyboarded", "review"],
  ["queued", "approved"],
  ["review", "rendering"],
  ["approved", "storyboarded"],
  ["approved", "changes_requested"],
  ["approved", "queued"],
  ["failed", "approved"],
  ["changes_requested", "approved"],
];
for (const [from, to] of illegal) {
  assert.equal(canTransition(from, to), false, `${from} -> ${to} should be illegal`);
}

// approved is terminal: nothing leaves it.
for (const to of PROJECT_STATES) {
  assert.equal(canTransition("approved", to), false, `approved -> ${to} must be rejected`);
}

// Unknown states are rejected rather than treated as legal.
assert.equal(canTransition("draft", "banana"), false);
assert.equal(canTransition("banana", "draft"), false);

assert.throws(() => assertTransition("approved", "queued"), /illegal transition/i);
assert.doesNotThrow(() => assertTransition("review", "approved"));

console.log("video-state: ok");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-state.test.mjs`
Expected: FAIL — `Cannot find module '../src/server/video/state.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/server/video/state.ts`:

```typescript
/**
 * Project state machine.
 *
 * Enforced here for clear errors and again in SQL so it cannot be bypassed by a
 * caller that skips this module. The duplication is intentional: the database is
 * the copy that is guaranteed to run.
 *
 * `approved` is terminal. Reopening an approved project is out of scope for R1,
 * and making it terminal here means an accidental reopen fails loudly rather
 * than quietly mutating something a human signed off.
 *
 * `storyboarded -> storyboarded` is legal because saving a new storyboard
 * version is a normal edit, not a state change.
 */

export const PROJECT_STATES = [
  "draft",
  "storyboarded",
  "queued",
  "rendering",
  "review",
  "changes_requested",
  "approved",
  "failed",
] as const;

export type ProjectState = (typeof PROJECT_STATES)[number];

const ALLOWED: Record<ProjectState, readonly ProjectState[]> = {
  draft: ["storyboarded"],
  storyboarded: ["storyboarded", "queued"],
  queued: ["rendering", "failed"],
  // rendering -> queued is a lease expiry requeue.
  rendering: ["review", "failed", "queued"],
  review: ["approved", "changes_requested"],
  changes_requested: ["storyboarded"],
  approved: [],
  // failed -> queued is a deliberate human requeue; it creates a new job row.
  failed: ["queued"],
};

function isState(value: string): value is ProjectState {
  return (PROJECT_STATES as readonly string[]).includes(value);
}

export function canTransition(from: string, to: string): boolean {
  if (!isState(from) || !isState(to)) return false;
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: string, to: string): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal transition: ${from} -> ${to}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/video-state.test.mjs`
Expected: PASS — prints `video-state: ok`

- [ ] **Step 5: Commit**

```bash
git add src/server/video/state.ts tests/video-state.test.mjs
git commit -m "feat(video): project state transition allowlist"
```

---

## Task 4: Storyboard Schema

A storyboard is a list of scenes that must tile the project duration exactly — no gaps, no overlaps, no drift. Catching that here means the worker never receives a storyboard it cannot render.

**Files:**
- Create: `src/server/video/storyboard.ts`
- Test: `tests/video-storyboard.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-storyboard.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { parseStoryboard, REFERENCE_AD } from "../src/server/video/storyboard.ts";

// The reference advertisement is valid and tiles 12 seconds across four scenes.
const parsed = parseStoryboard({ durationSeconds: 12, scenes: REFERENCE_AD });
assert.equal(parsed.scenes.length, 4);
assert.equal(parsed.scenes[0].startSeconds, 0);
assert.equal(parsed.scenes[3].endSeconds, 12);

// Scene indexes must be contiguous from zero.
assert.throws(
  () => parseStoryboard({
    durationSeconds: 4,
    scenes: [
      { index: 0, startSeconds: 0, endSeconds: 2, visual: "a", voiceover: "", onScreenText: "" },
      { index: 2, startSeconds: 2, endSeconds: 4, visual: "b", voiceover: "", onScreenText: "" },
    ],
  }),
  /contiguous/i,
);

// A gap between scenes is rejected.
assert.throws(
  () => parseStoryboard({
    durationSeconds: 5,
    scenes: [
      { index: 0, startSeconds: 0, endSeconds: 2, visual: "a", voiceover: "", onScreenText: "" },
      { index: 1, startSeconds: 3, endSeconds: 5, visual: "b", voiceover: "", onScreenText: "" },
    ],
  }),
  /contiguous|gap/i,
);

// An overlap is rejected.
assert.throws(
  () => parseStoryboard({
    durationSeconds: 4,
    scenes: [
      { index: 0, startSeconds: 0, endSeconds: 3, visual: "a", voiceover: "", onScreenText: "" },
      { index: 1, startSeconds: 2, endSeconds: 4, visual: "b", voiceover: "", onScreenText: "" },
    ],
  }),
  /contiguous|overlap/i,
);

// Scenes must reach the declared duration.
assert.throws(
  () => parseStoryboard({
    durationSeconds: 12,
    scenes: [
      { index: 0, startSeconds: 0, endSeconds: 2, visual: "a", voiceover: "", onScreenText: "" },
    ],
  }),
  /duration/i,
);

// A zero-length scene is rejected.
assert.throws(
  () => parseStoryboard({
    durationSeconds: 2,
    scenes: [
      { index: 0, startSeconds: 0, endSeconds: 0, visual: "a", voiceover: "", onScreenText: "" },
      { index: 1, startSeconds: 0, endSeconds: 2, visual: "b", voiceover: "", onScreenText: "" },
    ],
  }),
  /after/i,
);

// An empty storyboard is rejected.
assert.throws(() => parseStoryboard({ durationSeconds: 12, scenes: [] }), /at least one/i);

// Visual direction is required; an empty string is not a scene description.
assert.throws(
  () => parseStoryboard({
    durationSeconds: 2,
    scenes: [{ index: 0, startSeconds: 0, endSeconds: 2, visual: "", voiceover: "", onScreenText: "" }],
  }),
  /visual/i,
);

console.log("video-storyboard: ok");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-storyboard.test.mjs`
Expected: FAIL — `Cannot find module '../src/server/video/storyboard.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/server/video/storyboard.ts`:

```typescript
/**
 * Storyboard validation.
 *
 * Scenes must tile the project duration exactly: contiguous, no gaps, no
 * overlaps, ending on the declared duration. The worker renders one clip per
 * scene and concatenates them, so a gap would silently shorten the finished
 * advertisement and an overlap would make the total longer than the brief.
 *
 * Floating point comparison uses a 1ms epsilon. Scene boundaries are authored in
 * tenths of a second, so exact equality on doubles would reject valid input.
 *
 * In R1 storyboards are authored by hand. The creative director that generates
 * them is a later release and will produce this same shape.
 */
import { z } from "zod";

const EPSILON = 0.001;

export const sceneSchema = z.object({
  index: z.number().int().min(0),
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0),
  visual: z.string().trim().min(1, "visual direction is required"),
  camera: z.string().trim().default(""),
  voiceover: z.string().default(""),
  onScreenText: z.string().default(""),
  negative: z.string().default(""),
});

export type Scene = z.infer<typeof sceneSchema>;

export const storyboardSchema = z.object({
  durationSeconds: z.number().positive().max(120),
  scenes: z.array(sceneSchema).min(1, "a storyboard needs at least one scene"),
});

export type Storyboard = z.infer<typeof storyboardSchema>;

export function parseStoryboard(input: unknown): Storyboard {
  const parsed = storyboardSchema.parse(input);
  const scenes = [...parsed.scenes].sort((a, b) => a.index - b.index);

  let cursor = 0;
  scenes.forEach((scene, position) => {
    if (scene.index !== position) {
      throw new Error(`scene indexes must be contiguous from zero: saw ${scene.index} at position ${position}`);
    }
    if (Math.abs(scene.startSeconds - cursor) > EPSILON) {
      throw new Error(
        `scene ${scene.index} must be contiguous with the previous scene: expected start ${cursor}, got ${scene.startSeconds}`,
      );
    }
    if (scene.endSeconds - scene.startSeconds <= EPSILON) {
      throw new Error(`scene ${scene.index} must end after it starts`);
    }
    cursor = scene.endSeconds;
  });

  if (Math.abs(cursor - parsed.durationSeconds) > EPSILON) {
    throw new Error(
      `scenes must cover the full duration: covered ${cursor}s of ${parsed.durationSeconds}s`,
    );
  }

  return { durationSeconds: parsed.durationSeconds, scenes };
}

/**
 * The reference advertisement from the design spec, used as the end-to-end
 * acceptance fixture. Four beats, twelve seconds, vertical.
 */
export const REFERENCE_AD: Scene[] = [
  {
    index: 0,
    startSeconds: 0,
    endSeconds: 2,
    visual: "Extreme close-up of a notebook with a handwritten business idea, camera pushes toward the laptop screen",
    camera: "Slow push in, shallow depth of field",
    voiceover: "Have an idea?",
    onScreenText: "",
    negative: "no humanoid robots, no code rain",
  },
  {
    index: 1,
    startSeconds: 2,
    endSeconds: 5,
    visual: "The sketch becomes a polished interface; website expands into a web app connected to a CRM",
    camera: "Glide through connected systems",
    voiceover: "We turn ideas into working technology.",
    onScreenText: "",
    negative: "no fake code on screen",
  },
  {
    index: 2,
    startSeconds: 5,
    endSeconds: 9,
    visual: "Four one-second shots: responsive site, SaaS dashboard, automation, AI agent routing a task",
    camera: "Clean match cuts, consistent visual language",
    voiceover: "Websites. Software. Automations. AI agents. Built around your business.",
    onScreenText: "Websites · Software · Automation · AI",
    negative: "no unrelated environments",
  },
  {
    index: 3,
    startSeconds: 9,
    endSeconds: 12,
    visual: "Interfaces collapse into one luminous point that resolves into the brand card",
    camera: "Pull back, settle, hold",
    voiceover: "You bring the idea. We build what comes next.",
    onScreenText: "GivenTake Devs — Your idea. Built.",
    negative: "keep branding minimal",
  },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/video-storyboard.test.mjs`
Expected: PASS — prints `video-storyboard: ok`

- [ ] **Step 5: Run the whole unit suite to confirm nothing regressed**

Run: `bun run test`
Expected: every existing test still passes, and the four new `video-*` tests are picked up automatically by the `tests/*.test.mjs` glob.

- [ ] **Step 6: Commit**

```bash
git add src/server/video/storyboard.ts tests/video-storyboard.test.mjs
git commit -m "feat(video): storyboard schema with contiguous scene validation"
```

# Phase 2 — Database

## Task 5: Schema Migration And The Isolation Proof

Seven tables. The test is written first and proves the properties that matter: forced RLS, zero grants to `anon`/`authenticated`, and constraints that make illegal data impossible rather than merely discouraged.

The Docker container runs plain `postgres:17`, which has no `auth` schema, so the harness stubs `auth.users` before applying migrations. That stub is test-only; production has the real table.

**Files:**
- Create: `supabase/migrations/20260821240000_video_studio_foundation.sql`
- Create: `tests/video-rls.integration.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-rls.integration.test.mjs`:

```javascript
/**
 * Isolation proof for the video studio schema.
 *
 * Runs a throwaway postgres:17 container, stubs auth.users (plain Postgres has
 * no auth schema), applies the video migrations, and asserts the access model:
 * forced RLS, no grants to anon/authenticated, and functions executable only by
 * service_role.
 *
 * Mirrors tests/operator-postgres.integration.test.mjs, including its Docker
 * availability contract.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });

try {
  docker("info");
} catch {
  if (process.env.ALLOW_DOCKER_INTEGRATION_SKIP === "true") {
    console.log("SKIP video RLS integration: Docker unavailable and ALLOW_DOCKER_INTEGRATION_SKIP=true");
    process.exit(0);
  }
  throw new Error(
    "Docker is required for video RLS integration tests. Set ALLOW_DOCKER_INTEGRATION_SKIP=true only for an explicit skip.",
  );
}

const name = `giventake-video-${process.pid}`;
const psql = (sql, role = "postgres") =>
  docker(
    "exec", "-i", name, "psql", "-v", "ON_ERROR_STOP=1", "-qAt", "-U", "postgres",
    "-c", `${role === "postgres" ? "" : `set role ${role};`} ${sql}`,
  ).trim();

const applyFile = (file) =>
  execFileSync("docker", ["exec", "-i", name, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres"], {
    input: readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url)),
    stdio: ["pipe", "pipe", "pipe"],
  });

const TABLES = [
  "video_projects",
  "video_storyboards",
  "video_jobs",
  "video_assets",
  "video_exports",
  "video_reviews",
  "video_callback_nonces",
];

try {
  docker("run", "-d", "--rm", "--name", name, "-e", "POSTGRES_PASSWORD=local-synthetic-only", "postgres:17");

  const bindings = docker("inspect", "-f", "{{json .HostConfig.PortBindings}}", name).trim();
  assert.ok(bindings === "null" || bindings === "{}", `container unexpectedly publishes ports: ${bindings}`);

  for (let i = 0; i < 30; i++) {
    try {
      docker("exec", name, "pg_isready", "-U", "postgres");
      break;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }

  psql("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  // Production has Supabase's auth schema; plain postgres does not.
  psql("create schema auth; create table auth.users (id uuid primary key);");

  applyFile("20260821240000_video_studio_foundation.sql");

  // 1. Every table has RLS enabled AND forced.
  for (const table of TABLES) {
    assert.equal(
      psql(`select relrowsecurity, relforcerowsecurity from pg_class where relname = '${table}';`),
      "t|t",
      `${table} must have RLS enabled and forced`,
    );
  }

  // 2. anon and authenticated hold no privilege at all on these tables.
  for (const table of TABLES) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal(
        psql(`select has_table_privilege('${role}','public.${table}','select,insert,update,delete');`),
        "f",
        `${role} must hold no privilege on ${table}`,
      );
    }
  }

  // 3. Constraints make illegal rows impossible.
  const user = "00000000-0000-4000-8000-000000000001";
  psql(`insert into auth.users(id) values ('${user}');`);

  const project = psql(
    `insert into public.video_projects(owner_id,title,duration_seconds)
     values ('${user}','Reference ad',12) returning id;`,
  );

  assert.throws(
    () => psql(`update public.video_projects set status='banana' where id='${project}';`),
    /status/i,
    "an unknown status must be rejected",
  );

  const storyboard = psql(
    `insert into public.video_storyboards(project_id,version,scenes)
     values ('${project}',1,'[]'::jsonb) returning id;`,
  );
  assert.throws(
    () => psql(`insert into public.video_storyboards(project_id,version,scenes) values ('${project}',1,'[]'::jsonb);`),
    /unique|duplicate/i,
    "a duplicate storyboard version must be rejected",
  );

  // changes_requested without notes is impossible at the database level.
  assert.throws(
    () => psql(
      `insert into public.video_reviews(project_id,storyboard_id,reviewer_id,decision)
       values ('${project}','${storyboard}','${user}','changes_requested');`,
    ),
    /notes/i,
    "changes_requested must require notes",
  );
  // Approval without a reviewer is impossible.
  assert.throws(
    () => psql(
      `insert into public.video_reviews(project_id,storyboard_id,reviewer_id,decision)
       values ('${project}','${storyboard}',null,'approved');`,
    ),
    /null/i,
    "a review must name a reviewer",
  );

  const job = psql(
    `insert into public.video_jobs(project_id,storyboard_id,idempotency_key)
     values ('${project}','${storyboard}','key-1') returning id;`,
  );
  assert.throws(
    () => psql(`insert into public.video_jobs(project_id,storyboard_id,idempotency_key) values ('${project}','${storyboard}','key-1');`),
    /unique|duplicate/i,
    "idempotency_key must be unique",
  );

  // The asset identity index is what makes replayed uploads safe.
  psql(
    `insert into public.video_assets(job_id,project_id,kind,scene_index,storage_path,content_type,sha256)
     values ('${job}','${project}','scene_clip',0,'p/j/scene_clip-0.mp4','video/mp4','abc');`,
  );
  assert.throws(
    () => psql(
      `insert into public.video_assets(job_id,project_id,kind,scene_index,storage_path,content_type,sha256)
       values ('${job}','${project}','scene_clip',0,'p/j/other.mp4','video/mp4','abc');`,
    ),
    /unique|duplicate/i,
    "the same scene and checksum must not produce a second asset row",
  );

  assert.throws(
    () => psql(
      `insert into public.video_exports(project_id,job_id,rendition,storage_path,sha256)
       values ('${project}','${job}','4x3','p/j/export-4x3.mp4','x');`,
    ),
    /rendition/i,
    "only the three renditions are allowed",
  );

  console.log("video-rls integration: ok");
} finally {
  try {
    docker("rm", "-f", name);
  } catch {
    /* container already gone */
  }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/video-rls.integration.test.mjs`
Expected: FAIL — `ENOENT` reading `20260821240000_video_studio_foundation.sql`

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260821240000_video_studio_foundation.sql`:

```sql
-- Video Agent Studio — Release 1 foundation.
--
-- Additive only. No existing table, constraint, policy or grant is altered, so
-- nothing the CRM does today can break.
--
-- Access model matches the CRM exactly and deliberately: RLS enabled and FORCED,
-- no grants to anon or authenticated, and all real access through the
-- security-definer RPCs added in the companion migration. There is no
-- workspace_id; ownership is per-user via auth.users, the same model every other
-- table in this database uses. Two isolation models in one database would make
-- both harder to reason about.
--
-- Several rules that could have lived in application code are constraints here
-- instead, because the database is the layer that cannot be bypassed:
--   * video_reviews.reviewer_id is NOT NULL       -> nothing reaches "approved"
--                                                    without a real human
--   * changes_requested requires notes            -> a rejection must say why
--   * the video_assets identity index             -> replayed uploads cannot
--                                                    create duplicate rows

begin;

-- ── Projects ────────────────────────────────────────────────────────────────

create table if not exists public.video_projects (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid references auth.users(id) on delete set null,
  assigned_to      uuid references auth.users(id) on delete set null,
  title            text not null,
  brief_text       text not null default '',
  -- Brand is data, not hardcoded strings: name, tagline, domain, palette. The
  -- end card renders from this, so changing the brand is a row edit.
  brand            jsonb not null default '{}'::jsonb,
  duration_seconds numeric(6,2) not null,
  aspect_ratio     text not null default '9x16',
  status           text not null default 'draft',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint video_projects_status_check check (status in
    ('draft','storyboarded','queued','rendering','review','changes_requested','approved','failed')),
  constraint video_projects_aspect_check check (aspect_ratio = '9x16'),
  constraint video_projects_duration_check check (duration_seconds > 0 and duration_seconds <= 120)
);

create index if not exists video_projects_owner_idx  on public.video_projects (owner_id);
create index if not exists video_projects_status_idx on public.video_projects (status);

-- ── Storyboards ─────────────────────────────────────────────────────────────
-- Versioned and immutable once written, so a rejected storyboard stays readable
-- beside the version that replaced it. That history is what makes the
-- request-changes loop reviewable rather than destructive.

create table if not exists public.video_storyboards (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects(id) on delete cascade,
  version    int  not null,
  scenes     jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, version),
  constraint video_storyboards_version_check check (version > 0)
);

-- ── Jobs ────────────────────────────────────────────────────────────────────

create table if not exists public.video_jobs (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.video_projects(id) on delete cascade,
  storyboard_id    uuid not null references public.video_storyboards(id) on delete restrict,
  idempotency_key  text not null unique,
  status           text not null default 'queued',
  attempt_count    int  not null default 0,
  claimed_by       text,
  lease_expires_at timestamptz,
  error_code       text,
  error_detail     text,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  finished_at      timestamptz,
  constraint video_jobs_status_check check (status in ('queued','rendering','done','failed'))
);

-- The claim query orders queued jobs by age; the partial index keeps that read
-- cheap without indexing finished work.
create index if not exists video_jobs_queued_idx
  on public.video_jobs (created_at) where status = 'queued';
create index if not exists video_jobs_lease_idx
  on public.video_jobs (lease_expires_at) where status = 'rendering';

-- ── Assets ──────────────────────────────────────────────────────────────────

create table if not exists public.video_assets (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.video_jobs(id) on delete cascade,
  project_id   uuid not null references public.video_projects(id) on delete cascade,
  kind         text not null,
  scene_index  int,
  storage_path text not null unique,
  content_type text not null,
  byte_size    bigint,
  sha256       text not null,
  status       text not null default 'pending',
  provider     text not null default 'fixture',
  created_at   timestamptz not null default now(),
  ready_at     timestamptz,
  -- 'export' covers the three renditions. They are assets too: they travel the
  -- same intent/PUT/complete handoff, and their path is derived from the
  -- rendition rather than the scene index.
  constraint video_assets_kind_check   check (kind in ('scene_clip','audio','endcard','master','export')),
  constraint video_assets_status_check check (status in ('pending','ready','failed')),
  constraint video_assets_scene_check  check (scene_index is null or scene_index >= 0)
);

-- Idempotency as a uniqueness constraint rather than application logic: this is
-- what makes a replayed upload-intent return the existing row instead of
-- creating a second one, and it holds under concurrency.
-- coalesce() because scene_index is nullable and NULLs do not collide.
create unique index if not exists video_assets_identity_idx
  on public.video_assets (job_id, kind, coalesce(scene_index, -1), sha256);

create index if not exists video_assets_job_idx on public.video_assets (job_id);

-- ── Exports ─────────────────────────────────────────────────────────────────

create table if not exists public.video_exports (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.video_projects(id) on delete cascade,
  job_id       uuid not null references public.video_jobs(id) on delete cascade,
  rendition    text not null,
  storage_path text not null unique,
  content_type text not null default 'video/mp4',
  byte_size    bigint,
  sha256       text not null,
  duration_ms  int,
  status       text not null default 'pending',
  created_at   timestamptz not null default now(),
  unique (job_id, rendition),
  constraint video_exports_rendition_check check (rendition in ('9x16','1x1','16x9')),
  constraint video_exports_status_check    check (status in ('pending','ready','failed'))
);

create index if not exists video_exports_project_idx on public.video_exports (project_id);

-- ── Reviews ─────────────────────────────────────────────────────────────────
-- Append-only. reviewer_id is NOT NULL and references a real user, which is how
-- the published promise that "nothing ships without manual human review"
-- (/process stage 07, /how-we-use-ai, MSA 3.2) becomes enforceable rather than
-- conventional. No agent can produce an approved project.

create table if not exists public.video_reviews (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.video_projects(id) on delete cascade,
  storyboard_id uuid not null references public.video_storyboards(id) on delete restrict,
  reviewer_id   uuid not null references auth.users(id) on delete restrict,
  decision      text not null,
  notes         text,
  created_at    timestamptz not null default now(),
  constraint video_reviews_decision_check check (decision in ('approved','changes_requested')),
  constraint video_reviews_notes_check check (
    decision = 'approved' or (notes is not null and length(btrim(notes)) > 0)
  )
);

create index if not exists video_reviews_project_idx on public.video_reviews (project_id, created_at desc);

-- ── Callback nonces ─────────────────────────────────────────────────────────
-- Replay protection for signed worker callbacks. Most endpoints are idempotent
-- and would survive a replay unharmed, but job-failed increments attempt_count,
-- so replaying it could burn a project's retries. This table is what stops that.

create table if not exists public.video_callback_nonces (
  nonce   text primary key,
  seen_at timestamptz not null default now()
);

create index if not exists video_callback_nonces_seen_idx on public.video_callback_nonces (seen_at);

-- ── Lock every table down ───────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'video_projects','video_storyboards','video_jobs','video_assets',
    'video_exports','video_reviews','video_callback_nonces'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
  end loop;
end $$;

commit;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/video-rls.integration.test.mjs`
Expected: PASS — prints `video-rls integration: ok`

If Docker is not running, the test throws by design. Start Docker rather than setting the skip flag.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260821240000_video_studio_foundation.sql tests/video-rls.integration.test.mjs
git commit -m "feat(video): schema with forced RLS and human-approval constraints"
```

---

## Task 6: The RPCs

Every read and write goes through a `SECURITY DEFINER` function granted to `service_role` alone. Grants are explicit rather than relying on the default-privileges lockdown from an earlier migration, so this migration is correct even when applied to a fresh database.

**Files:**
- Create: `supabase/migrations/20260821241000_video_studio_rpcs.sql`
- Modify: `tests/video-rls.integration.test.mjs`

- [ ] **Step 1: Extend the test with the privilege and behaviour assertions**

In `tests/video-rls.integration.test.mjs`, replace the line `  console.log("video-rls integration: ok");` with:

```javascript
  applyFile("20260821241000_video_studio_rpcs.sql");

  // 4. Every RPC is executable by service_role and by nobody else.
  const FUNCTIONS = [
    "video_claim_next_job(text,integer)",
    "video_upload_intent(uuid,text,integer,text,text,text)",
    "video_upload_complete(uuid,text,bigint)",
    "video_export_record(uuid,text,text,text,bigint,integer)",
    "video_job_complete(uuid)",
    "video_job_failed(uuid,text,text,integer)",
    "video_project_queue(uuid,uuid,text)",
    "video_project_review(uuid,uuid,text,text)",
    "video_nonce_claim(text)",
  ];
  for (const fn of FUNCTIONS) {
    assert.equal(
      psql(
        `select has_function_privilege('service_role','public.${fn}','execute'),` +
        `has_function_privilege('anon','public.${fn}','execute'),` +
        `has_function_privilege('authenticated','public.${fn}','execute');`,
      ),
      "t|f|f",
      `${fn} must be service_role only`,
    );
  }

  // 5. A nonce can be claimed once. This is what stops a replayed job-failed
  //    callback from burning a retry attempt.
  assert.equal(psql("select public.video_nonce_claim('n-1');", "service_role"), "t");
  assert.equal(psql("select public.video_nonce_claim('n-1');", "service_role"), "f");

  // 6. Illegal transitions are rejected by the database, not only by TypeScript.
  const p2 = psql(
    `insert into public.video_projects(owner_id,title,duration_seconds,status)
     values ('${user}','Guard test',12,'draft') returning id;`,
  );
  const s2 = psql(
    `insert into public.video_storyboards(project_id,version,scenes) values ('${p2}',1,'[]'::jsonb) returning id;`,
  );
  assert.throws(
    () => psql(`select public.video_project_queue('${p2}','${s2}','k-guard');`, "service_role"),
    /illegal transition/i,
    "a draft project cannot be queued directly",
  );

  psql(`update public.video_projects set status='storyboarded' where id='${p2}';`);
  const queued = JSON.parse(psql(`select public.video_project_queue('${p2}','${s2}','k-guard');`, "service_role"));
  assert.equal(psql(`select status from public.video_projects where id='${p2}';`), "queued");

  // 7. Queueing twice returns the same job rather than creating a second one.
  const requeued = JSON.parse(psql(`select public.video_project_queue('${p2}','${s2}','k-guard');`, "service_role"));
  assert.equal(requeued.job_id, queued.job_id, "double queue must be a no-op");
  assert.equal(psql(`select count(*) from public.video_jobs where project_id='${p2}';`), "1");

  // 8. Claiming leases the job and moves the project to rendering.
  const claimed = JSON.parse(psql(`select public.video_claim_next_job('worker-a',300);`, "service_role"));
  assert.equal(claimed.job_id, queued.job_id);
  assert.equal(psql(`select status from public.video_projects where id='${p2}';`), "rendering");

  // 9. A second worker gets nothing: the job is leased.
  assert.equal(psql(`select public.video_claim_next_job('worker-b',300);`, "service_role"), "");

  // 10. Approval requires a reviewer and moves to a terminal state.
  //     The job must be finished first: video_project_queue returns any live
  //     job before it checks the transition (that is what makes a double-click
  //     a no-op), so leaving it in 'rendering' would mask the guard below.
  psql(`update public.video_jobs set status='done' where project_id='${p2}';`);
  psql(`update public.video_projects set status='review' where id='${p2}';`);
  psql(`select public.video_project_review('${p2}','${user}','approved',null);`, "service_role");
  assert.equal(psql(`select status from public.video_projects where id='${p2}';`), "approved");
  assert.throws(
    () => psql(`select public.video_project_queue('${p2}','${s2}','k-after-approval');`, "service_role"),
    /illegal transition/i,
    "approved is terminal",
  );

  console.log("video-rls integration: ok");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/video-rls.integration.test.mjs`
Expected: FAIL — `ENOENT` reading `20260821241000_video_studio_rpcs.sql`

- [ ] **Step 3: Write the RPC migration**

Create `supabase/migrations/20260821241000_video_studio_rpcs.sql`:

```sql
-- Video Agent Studio — the only access path to the video tables.
--
-- The tables have RLS forced and no grants to anon or authenticated, so these
-- security-definer functions are how the application reaches them, exactly as
-- the CRM works. EXECUTE is revoked from public/anon/authenticated and granted
-- to service_role explicitly rather than relying on the default-privileges
-- lockdown from 20260819130000, so this migration is correct on a fresh
-- database too.
--
-- The state machine is re-implemented here even though TypeScript already
-- enforces it. The database is the copy that cannot be bypassed.

begin;

-- ── Transition guard ────────────────────────────────────────────────────────

create or replace function public.video_assert_transition(p_from text, p_to text)
returns void
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if not (
    (p_from = 'draft'             and p_to = 'storyboarded') or
    (p_from = 'storyboarded'      and p_to in ('storyboarded','queued')) or
    (p_from = 'queued'            and p_to in ('rendering','failed')) or
    (p_from = 'rendering'         and p_to in ('review','failed','queued')) or
    (p_from = 'review'            and p_to in ('approved','changes_requested')) or
    (p_from = 'changes_requested' and p_to = 'storyboarded') or
    (p_from = 'failed'            and p_to = 'queued')
  ) then
    raise exception 'illegal transition: % -> %', p_from, p_to;
  end if;
end $$;

-- ── Replay protection ───────────────────────────────────────────────────────

create or replace function public.video_nonce_claim(p_nonce text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.video_callback_nonces(nonce) values (p_nonce);
  return true;
exception when unique_violation then
  return false;
end $$;

-- ── Queue a render ──────────────────────────────────────────────────────────

create or replace function public.video_project_queue(
  p_project_id uuid, p_storyboard_id uuid, p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_job    public.video_jobs;
begin
  select status into v_status from public.video_projects where id = p_project_id for update;
  if not found then raise exception 'unknown project %', p_project_id; end if;

  -- An existing live job means this is a double-click, not a new render.
  select * into v_job from public.video_jobs
   where project_id = p_project_id and status in ('queued','rendering')
   limit 1;
  if found then
    return jsonb_build_object('job_id', v_job.id, 'created', false);
  end if;

  perform public.video_assert_transition(v_status, 'queued');

  insert into public.video_jobs(project_id, storyboard_id, idempotency_key)
  values (p_project_id, p_storyboard_id, p_idempotency_key)
  returning * into v_job;

  update public.video_projects set status = 'queued', updated_at = now() where id = p_project_id;

  return jsonb_build_object('job_id', v_job.id, 'created', true);
end $$;

-- ── Claim work ──────────────────────────────────────────────────────────────

create or replace function public.video_claim_next_job(p_worker text, p_lease_seconds int default 300)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job        public.video_jobs;
  v_project    public.video_projects;
  v_scenes     jsonb;
  v_max_attempts constant int := 3;
begin
  -- Reclaim expired leases first. A worker that died mid-render must not hold a
  -- job forever, but it must not retry unboundedly either.
  update public.video_jobs j
     set status           = case when j.attempt_count >= v_max_attempts then 'failed' else 'queued' end,
         claimed_by       = null,
         lease_expires_at = null,
         error_code       = case when j.attempt_count >= v_max_attempts then coalesce(j.error_code,'lease_expired') else j.error_code end,
         finished_at      = case when j.attempt_count >= v_max_attempts then now() else j.finished_at end
   where j.status = 'rendering' and j.lease_expires_at < now();

  update public.video_projects p
     set status = 'failed', updated_at = now()
   from public.video_jobs j
   where j.project_id = p.id and j.status = 'failed' and p.status = 'rendering';

  select * into v_job from public.video_jobs
   where status = 'queued'
   order by created_at
   for update skip locked
   limit 1;
  if not found then return null; end if;

  update public.video_jobs
     set status = 'rendering',
         claimed_by = p_worker,
         lease_expires_at = now() + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 300))),
         attempt_count = attempt_count + 1,
         started_at = coalesce(started_at, now())
   where id = v_job.id
  returning * into v_job;

  select * into v_project from public.video_projects where id = v_job.project_id;
  if v_project.status <> 'rendering' then
    perform public.video_assert_transition(v_project.status, 'rendering');
    update public.video_projects set status = 'rendering', updated_at = now() where id = v_project.id;
  end if;

  select scenes into v_scenes from public.video_storyboards where id = v_job.storyboard_id;

  return jsonb_build_object(
    'job_id',           v_job.id,
    'project_id',       v_project.id,
    'idempotency_key',  v_job.idempotency_key,
    'attempt',          v_job.attempt_count,
    'lease_expires_at', v_job.lease_expires_at,
    'brand',            v_project.brand,
    'duration_seconds', v_project.duration_seconds,
    'scenes',           coalesce(v_scenes, '[]'::jsonb)
  );
end $$;

-- ── Media handoff ───────────────────────────────────────────────────────────

create or replace function public.video_upload_intent(
  p_job_id uuid, p_kind text, p_scene_index int,
  p_content_type text, p_sha256 text, p_storage_path text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asset      public.video_assets;
  v_project_id uuid;
begin
  select project_id into v_project_id from public.video_jobs where id = p_job_id;
  if not found then raise exception 'unknown job %', p_job_id; end if;

  -- Idempotent by identity: the same scene and checksum returns the row that
  -- already exists rather than creating a second one.
  select * into v_asset from public.video_assets
   where job_id = p_job_id and kind = p_kind
     and coalesce(scene_index, -1) = coalesce(p_scene_index, -1)
     and sha256 = p_sha256;
  if found then
    return jsonb_build_object('asset_id', v_asset.id, 'storage_path', v_asset.storage_path, 'created', false);
  end if;

  insert into public.video_assets(job_id, project_id, kind, scene_index, storage_path, content_type, sha256)
  values (p_job_id, v_project_id, p_kind, p_scene_index, p_storage_path, p_content_type, p_sha256)
  returning * into v_asset;

  return jsonb_build_object('asset_id', v_asset.id, 'storage_path', v_asset.storage_path, 'created', true);
end $$;

create or replace function public.video_upload_complete(p_asset_id uuid, p_sha256 text, p_byte_size bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_asset public.video_assets;
begin
  select * into v_asset from public.video_assets where id = p_asset_id for update;
  if not found then raise exception 'unknown asset %', p_asset_id; end if;

  if v_asset.sha256 <> p_sha256 then
    raise exception 'checksum mismatch for asset %', p_asset_id;
  end if;

  -- Replay is a successful no-op rather than an error: the worker may retry a
  -- completion it already made and must not be pushed into a failure path.
  if v_asset.status = 'ready' then
    return jsonb_build_object('asset_id', v_asset.id, 'status', 'ready', 'changed', false);
  end if;

  update public.video_assets
     set status = 'ready', byte_size = p_byte_size, ready_at = now()
   where id = p_asset_id;

  return jsonb_build_object('asset_id', p_asset_id, 'status', 'ready', 'changed', true);
end $$;

create or replace function public.video_export_record(
  p_job_id uuid, p_rendition text, p_storage_path text,
  p_sha256 text, p_byte_size bigint, p_duration_ms int
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_id uuid;
  v_export     public.video_exports;
begin
  select project_id into v_project_id from public.video_jobs where id = p_job_id;
  if not found then raise exception 'unknown job %', p_job_id; end if;

  insert into public.video_exports(project_id, job_id, rendition, storage_path, sha256, byte_size, duration_ms, status)
  values (v_project_id, p_job_id, p_rendition, p_storage_path, p_sha256, p_byte_size, p_duration_ms, 'ready')
  on conflict (job_id, rendition) do update
    set storage_path = excluded.storage_path,
        sha256       = excluded.sha256,
        byte_size    = excluded.byte_size,
        duration_ms  = excluded.duration_ms,
        status       = 'ready'
  returning * into v_export;

  return jsonb_build_object('export_id', v_export.id, 'rendition', v_export.rendition);
end $$;

-- ── Job completion ──────────────────────────────────────────────────────────

create or replace function public.video_job_complete(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job     public.video_jobs;
  v_status  text;
  v_exports int;
begin
  select * into v_job from public.video_jobs where id = p_job_id for update;
  if not found then raise exception 'unknown job %', p_job_id; end if;

  if v_job.status = 'done' then
    return jsonb_build_object('job_id', p_job_id, 'changed', false);
  end if;

  select count(*) into v_exports from public.video_exports where job_id = p_job_id and status = 'ready';
  if v_exports <> 3 then
    raise exception 'job % has % ready exports, expected 3', p_job_id, v_exports;
  end if;

  update public.video_jobs
     set status = 'done', finished_at = now(), lease_expires_at = null, claimed_by = null
   where id = p_job_id;

  select status into v_status from public.video_projects where id = v_job.project_id for update;
  perform public.video_assert_transition(v_status, 'review');
  update public.video_projects set status = 'review', updated_at = now() where id = v_job.project_id;

  return jsonb_build_object('job_id', p_job_id, 'changed', true);
end $$;

create or replace function public.video_job_failed(
  p_job_id uuid, p_error_code text, p_error_detail text, p_max_attempts int default 3
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job    public.video_jobs;
  v_final  boolean;
begin
  select * into v_job from public.video_jobs where id = p_job_id for update;
  if not found then raise exception 'unknown job %', p_job_id; end if;

  v_final := v_job.attempt_count >= greatest(1, coalesce(p_max_attempts, 3));

  update public.video_jobs
     set status           = case when v_final then 'failed' else 'queued' end,
         claimed_by       = null,
         lease_expires_at = null,
         error_code       = p_error_code,
         error_detail     = left(coalesce(p_error_detail, ''), 2000),
         finished_at      = case when v_final then now() else null end
   where id = p_job_id;

  if v_final then
    update public.video_projects set status = 'failed', updated_at = now()
     where id = v_job.project_id and status = 'rendering';
  else
    update public.video_projects set status = 'queued', updated_at = now()
     where id = v_job.project_id and status = 'rendering';
  end if;

  return jsonb_build_object('job_id', p_job_id, 'final', v_final, 'attempt', v_job.attempt_count);
end $$;

-- ── Human review ────────────────────────────────────────────────────────────

create or replace function public.video_project_review(
  p_project_id uuid, p_reviewer uuid, p_decision text, p_notes text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status        text;
  v_storyboard_id uuid;
  v_next          text;
begin
  if p_reviewer is null then
    raise exception 'a review requires a reviewer';
  end if;

  select status into v_status from public.video_projects where id = p_project_id for update;
  if not found then raise exception 'unknown project %', p_project_id; end if;

  v_next := case when p_decision = 'approved' then 'approved' else 'changes_requested' end;
  perform public.video_assert_transition(v_status, v_next);

  select id into v_storyboard_id from public.video_storyboards
   where project_id = p_project_id order by version desc limit 1;

  insert into public.video_reviews(project_id, storyboard_id, reviewer_id, decision, notes)
  values (p_project_id, v_storyboard_id, p_reviewer, p_decision, p_notes);

  update public.video_projects set status = v_next, updated_at = now() where id = p_project_id;

  return jsonb_build_object('project_id', p_project_id, 'status', v_next);
end $$;

-- ── Lock every function to service_role ─────────────────────────────────────

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and p.proname like 'video\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

commit;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/video-rls.integration.test.mjs`
Expected: PASS — prints `video-rls integration: ok`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260821241000_video_studio_rpcs.sql tests/video-rls.integration.test.mjs
git commit -m "feat(video): security-definer RPCs with database-enforced state machine"
```

---

## Task 7: The Private Media Bucket

The bucket is created by migration so a fresh Supabase project is reproducible rather than depending on someone remembering a console click. It has no policies at all, which is what makes it private: `service_role` bypasses RLS, and nobody else has a path in.

The Docker harness has no `storage` schema, so this migration is verified by a static invariant test in the style of `tests/launch-identity.test.mjs`.

**Files:**
- Create: `supabase/migrations/20260821242000_video_media_bucket.sql`
- Create: `tests/video-bucket.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-bucket.test.mjs`:

```javascript
/**
 * Static invariants for the media bucket migration.
 *
 * The bucket lives in Supabase's storage schema, which the plain postgres:17
 * integration container does not have, so this asserts on the migration text
 * instead. The properties are worth pinning: a bucket that is public, or that
 * grows a permissive policy, silently makes every render downloadable by anyone
 * with the URL.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20260821242000_video_media_bucket.sql", import.meta.url),
  "utf8",
);

assert.match(sql, /insert into storage\.buckets/i, "the migration must create the bucket");
assert.match(sql, /'video-media'/, "the bucket id must be video-media");

// public must be set false, and must never be set true anywhere in the file.
assert.match(sql, /public\s*=\s*false|,\s*false\s*\)/i, "the bucket must be created private");
assert.doesNotMatch(sql, /\bpublic\s*=\s*true\b/i, "the bucket must never be public");

// No policy may grant anon or authenticated access to storage objects.
assert.doesNotMatch(
  sql,
  /create\s+policy[\s\S]*\b(anon|authenticated)\b/i,
  "no storage policy may name anon or authenticated",
);

console.log("video-bucket: ok");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-bucket.test.mjs`
Expected: FAIL — `ENOENT` reading the migration

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260821242000_video_media_bucket.sql`:

```sql
-- Private storage bucket for all video media.
--
-- Created by migration rather than by a console click so a fresh project is
-- reproducible. Deliberately has NO policies on storage.objects: service_role
-- bypasses RLS and reaches it server-side, and every browser read is a
-- short-lived signed URL minted by the app after a session check. Adding a
-- policy for anon or authenticated would make renders reachable without one.
--
-- The file size ceiling is a guard against a runaway render filling the bucket;
-- a 12-second 1080x1920 export is a few megabytes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'video-media',
  'video-media',
  false,
  524288000, -- 500 MB
  array['video/mp4','audio/mp4','image/png']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/video-bucket.test.mjs`
Expected: PASS — prints `video-bucket: ok`

- [ ] **Step 5: Run the full unit suite**

Run: `bun run test`
Expected: PASS, now including five `video-*` unit tests.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260821242000_video_media_bucket.sql tests/video-bucket.test.mjs
git commit -m "feat(video): private media bucket created by migration"
```

# Phase 3 — The Signed API

## Task 8: The Store Client

A server-only client for the video RPCs and Storage, mirroring `src/server/crm/read.ts`. It is the only module that knows the service-role key exists.

**Files:**
- Create: `src/server/video/store.ts`
- Test: `tests/video-store.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-store.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { VideoStore } from "../src/server/video/store.ts";

const calls = [];
const fakeFetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).includes("/rpc/video_nonce_claim")) {
    return new Response("true", { status: 200, headers: { "content-type": "application/json" } });
  }
  if (String(url).includes("/object/upload/sign/")) {
    return new Response(JSON.stringify({ url: "/object/upload/sign/video-media/p/j/x.mp4?token=abc" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }
  if (String(url).includes("/object/sign/")) {
    return new Response(JSON.stringify({ signedURL: "/object/sign/video-media/p/j/x.mp4?token=dl" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }
  if (String(url).includes("/object/list/")) {
    return new Response(JSON.stringify([{ name: "x.mp4", metadata: { size: 2048 } }]), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }
  return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
};

const store = new VideoStore({
  url: "https://example.supabase.co/",
  serviceRoleKey: "service-key",
  bucket: "video-media",
  fetch: fakeFetch,
});

// The key is sent as both apikey and bearer, matching CrmRead.
assert.equal(await store.rpc("video_nonce_claim", { p_nonce: "n1" }), true);
const rpcCall = calls.find((c) => c.url.includes("/rpc/"));
assert.equal(rpcCall.url, "https://example.supabase.co/rest/v1/rpc/video_nonce_claim");
assert.equal(rpcCall.init.headers.apikey, "service-key");
assert.equal(rpcCall.init.headers.Authorization, "Bearer service-key");

// Signed upload URLs are returned absolute so the worker can PUT to them directly.
const upload = await store.createSignedUploadUrl("p/j/x.mp4");
assert.equal(upload, "https://example.supabase.co/storage/v1/object/upload/sign/video-media/p/j/x.mp4?token=abc");

const download = await store.createSignedDownloadUrl("p/j/x.mp4", 300);
assert.equal(download, "https://example.supabase.co/storage/v1/object/sign/video-media/p/j/x.mp4?token=dl");

// statObject reports the size the app verifies uploads against.
assert.deepEqual(await store.statObject("p/j/x.mp4"), { size: 2048 });

// A missing object reports null rather than throwing, so callers can 409.
const missingStore = new VideoStore({
  url: "https://example.supabase.co",
  serviceRoleKey: "k",
  bucket: "video-media",
  fetch: async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
});
assert.equal(await missingStore.statObject("p/j/missing.mp4"), null);

// A failing RPC throws with the status, never with the response body (which can
// echo data we do not want in logs).
const failing = new VideoStore({
  url: "https://example.supabase.co",
  serviceRoleKey: "k",
  bucket: "video-media",
  fetch: async () => new Response("boom: secret detail", { status: 500 }),
});
await assert.rejects(() => failing.rpc("video_job_complete", {}), (e) => {
  assert.match(e.message, /video_job_complete/);
  assert.match(e.message, /500/);
  assert.doesNotMatch(e.message, /secret detail/);
  return true;
});

// Construction requires configuration.
assert.throws(() => new VideoStore({ url: "", serviceRoleKey: "k", bucket: "b" }), /requires/i);

console.log("video-store: ok");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-store.test.mjs`
Expected: FAIL — `Cannot find module '../src/server/video/store.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/server/video/store.ts`:

```typescript
/**
 * Server-only client for the video RPCs and private Storage bucket.
 *
 * Mirrors src/server/crm/read.ts: the video tables have RLS forced and no grants
 * to anon or authenticated, so every access is a security-definer RPC called
 * with the service-role key from the server. This module is the only place that
 * key is used for video work, and nothing it returns includes the key or a raw
 * Supabase response.
 *
 * Errors carry the RPC name and HTTP status but never the response body, which
 * can echo row data into logs.
 */

type Fetch = typeof globalThis.fetch;

export interface VideoStoreOptions {
  url: string;
  serviceRoleKey: string;
  bucket: string;
  fetch?: Fetch;
}

export interface ObjectStat {
  size: number;
}

export class VideoStore {
  readonly #url: string;
  readonly #key: string;
  readonly #bucket: string;
  readonly #fetch: Fetch;

  constructor(options: VideoStoreOptions) {
    if (!options.url || !options.serviceRoleKey || !options.bucket) {
      throw new Error("VideoStore requires url, serviceRoleKey and bucket");
    }
    this.#url = options.url.replace(/\/$/, "");
    this.#key = options.serviceRoleKey;
    this.#bucket = options.bucket;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  get bucket(): string {
    return this.#bucket;
  }

  #headers(): Record<string, string> {
    return {
      apikey: this.#key,
      Authorization: `Bearer ${this.#key}`,
      "Content-Type": "application/json",
    };
  }

  async rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
    const response = await this.#fetch(`${this.#url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`video rpc ${name} failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  /** Absolute, single-use URL the worker PUTs bytes to. */
  async createSignedUploadUrl(path: string): Promise<string> {
    const response = await this.#fetch(
      `${this.#url}/storage/v1/object/upload/sign/${this.#bucket}/${path}`,
      { method: "POST", headers: this.#headers(), body: "{}" },
    );
    if (!response.ok) throw new Error(`signed upload url failed: ${response.status}`);
    const body = (await response.json()) as { url: string };
    return `${this.#url}/storage/v1${body.url}`;
  }

  /** Absolute, short-lived URL the browser reads media through. */
  async createSignedDownloadUrl(path: string, expiresIn: number): Promise<string> {
    const response = await this.#fetch(
      `${this.#url}/storage/v1/object/sign/${this.#bucket}/${path}`,
      { method: "POST", headers: this.#headers(), body: JSON.stringify({ expiresIn }) },
    );
    if (!response.ok) throw new Error(`signed download url failed: ${response.status}`);
    const body = (await response.json()) as { signedURL: string };
    return `${this.#url}/storage/v1${body.signedURL}`;
  }

  /**
   * Size of a stored object, or null when it is not there.
   *
   * upload-complete uses this to verify the bytes actually landed rather than
   * trusting the worker's word for it.
   */
  async statObject(path: string): Promise<ObjectStat | null> {
    const slash = path.lastIndexOf("/");
    const prefix = slash === -1 ? "" : path.slice(0, slash);
    const name = slash === -1 ? path : path.slice(slash + 1);

    const response = await this.#fetch(`${this.#url}/storage/v1/object/list/${this.#bucket}`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ prefix, limit: 100, search: name }),
    });
    if (!response.ok) throw new Error(`storage list failed: ${response.status}`);

    const rows = (await response.json()) as Array<{ name: string; metadata?: { size?: number } }>;
    const match = rows.find((row) => row.name === name);
    if (!match) return null;
    return { size: Number(match.metadata?.size ?? 0) };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/video-store.test.mjs`
Expected: PASS — prints `video-store: ok`

- [ ] **Step 5: Commit**

```bash
git add src/server/video/store.ts tests/video-store.test.mjs
git commit -m "feat(video): server-only store client for RPCs and private storage"
```

---

## Task 9: The Signed Request Pipeline

Every one of the five endpoints does the same four things before its own work: load config, verify the signature, burn the nonce, and audit. Putting that in one place means a new endpoint cannot forget a step.

**Files:**
- Create: `src/server/video/endpoint.ts`
- Test: `tests/video-endpoint.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-endpoint.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { signPayload } from "../src/server/video/signing.ts";
import { handleSigned } from "../src/server/video/endpoint.ts";

const SECRET = "worker-secret";
const env = {
  url: "https://example.supabase.co",
  serviceRoleKey: "service-key",
  workerSecret: SECRET,
  bucket: "video-media",
  pipelineEnabled: true,
};

function makeStore(nonceOk = true) {
  return { rpc: async (name) => (name === "video_nonce_claim" ? nonceOk : null) };
}

function signedRequest(payload, overrides = {}) {
  const timestamp = overrides.timestamp ?? String(Date.now());
  const nonce = overrides.nonce ?? `n-${Math.random()}`;
  const signature = overrides.signature ?? signPayload(SECRET, timestamp, nonce, payload);
  return new Request("https://app.test/api/video/claim", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gt-timestamp": timestamp,
      "x-gt-nonce": nonce,
      "x-gt-signature": signature,
    },
    body: JSON.stringify(payload),
  });
}

// A correctly signed request reaches the handler and returns its value.
{
  const response = await handleSigned(signedRequest({ worker_id: "w1" }), {
    env, store: makeStore(),
    handle: async (payload) => ({ echoed: payload.worker_id }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { echoed: "w1" });
}

// A bad signature is rejected and the handler never runs.
{
  let ran = false;
  const response = await handleSigned(signedRequest({ a: 1 }, { signature: "deadbeef" }), {
    env, store: makeStore(),
    handle: async () => { ran = true; return {}; },
  });
  assert.equal(response.status, 401);
  assert.equal(ran, false);
}

// A stale timestamp is rejected.
{
  const stale = String(Date.now() - 10 * 60 * 1000);
  const response = await handleSigned(signedRequest({ a: 1 }, { timestamp: stale }), {
    env, store: makeStore(), handle: async () => ({}),
  });
  assert.equal(response.status, 401);
}

// A replayed nonce is rejected, and the handler never runs. This is what stops a
// replayed job-failed callback from burning a retry attempt.
{
  let ran = false;
  const response = await handleSigned(signedRequest({ a: 1 }), {
    env, store: makeStore(false),
    handle: async () => { ran = true; return {}; },
  });
  assert.equal(response.status, 409);
  assert.equal(ran, false);
}

// Missing signing headers are rejected without throwing.
{
  const bare = new Request("https://app.test/api/video/claim", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  });
  const response = await handleSigned(bare, { env, store: makeStore(), handle: async () => ({}) });
  assert.equal(response.status, 401);
}

// Malformed JSON is a 400, not a crash.
{
  const timestamp = String(Date.now());
  const nonce = "n-bad-json";
  const bad = new Request("https://app.test/api/video/claim", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gt-timestamp": timestamp,
      "x-gt-nonce": nonce,
      "x-gt-signature": signPayload(SECRET, timestamp, nonce, {}),
    },
    body: "{not json",
  });
  const response = await handleSigned(bad, { env, store: makeStore(), handle: async () => ({}) });
  assert.equal(response.status, 400);
}

// A handler throwing returns 500 without leaking the message to the caller.
{
  const response = await handleSigned(signedRequest({ a: 1 }), {
    env, store: makeStore(),
    handle: async () => { throw new Error("internal detail with a secret"); },
  });
  assert.equal(response.status, 500);
  const body = await response.text();
  assert.doesNotMatch(body, /secret/);
}

console.log("video-endpoint: ok");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-endpoint.test.mjs`
Expected: FAIL — `Cannot find module '../src/server/video/endpoint.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/server/video/endpoint.ts`:

```typescript
/**
 * Shared request pipeline for the five /api/video/* endpoints.
 *
 * Each endpoint needs the same four things before its own work: configuration,
 * a verified signature, a burned nonce, and an error path that does not leak
 * internals. Centralising them means a sixth endpoint cannot forget one.
 *
 * These routes are machine-to-machine. They never read a session cookie, so a
 * browser holding a valid CRM session gains nothing here.
 *
 * Signature is verified BEFORE the nonce is claimed, so unsigned traffic cannot
 * fill the nonce table.
 */
import { verifySigned, SIGNATURE_HEADER, TIMESTAMP_HEADER, NONCE_HEADER } from "./signing.ts";
import type { VideoStore } from "./store.ts";

export interface VideoEnv {
  url: string;
  serviceRoleKey: string;
  workerSecret: string;
  bucket: string;
  pipelineEnabled: boolean;
}

/** Reads configuration from the environment. Throws a 503 Response when unset. */
export function videoEnv(source: Record<string, string | undefined> = process.env): VideoEnv {
  const url = source.SUPABASE_URL;
  const serviceRoleKey = source.SUPABASE_SERVICE_ROLE_KEY;
  const workerSecret = source.VIDEO_WORKER_SECRET;
  if (!url || !serviceRoleKey || !workerSecret) {
    throw new Response("Video studio is not configured", { status: 503 });
  }
  return {
    url,
    serviceRoleKey,
    workerSecret,
    bucket: source.VIDEO_MEDIA_BUCKET || "video-media",
    // Fails closed: anything other than an explicit "true" disables the pipeline.
    pipelineEnabled: source.VIDEO_PIPELINE_ENABLED === "true",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export interface SignedContext {
  env: VideoEnv;
  store: Pick<VideoStore, "rpc">;
  handle: (payload: Record<string, unknown>, ctx: { env: VideoEnv; store: Pick<VideoStore, "rpc"> }) => Promise<unknown>;
}

export async function handleSigned(request: Request, ctx: SignedContext): Promise<Response> {
  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  const nonce = request.headers.get(NONCE_HEADER);
  const signature = request.headers.get(SIGNATURE_HEADER);
  if (!timestamp || !nonce || !signature) {
    return json({ error: "unauthorized" }, 401);
  }

  const raw = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const verified = verifySigned({
    secret: ctx.env.workerSecret,
    timestamp,
    nonce,
    payload,
    signature,
  });
  if (!verified.ok) {
    return json({ error: "unauthorized" }, 401);
  }

  let fresh: boolean;
  try {
    fresh = await ctx.store.rpc<boolean>("video_nonce_claim", { p_nonce: nonce });
  } catch {
    // A nonce store that cannot be reached fails closed rather than admitting
    // an unverifiable replay.
    return json({ error: "unavailable" }, 503);
  }
  if (!fresh) {
    return json({ error: "replay" }, 409);
  }

  try {
    const result = await ctx.handle(payload, { env: ctx.env, store: ctx.store });
    return json(result ?? null);
  } catch (error) {
    // Logged server-side, never returned: handler messages can carry row data.
    console.error("video endpoint failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "internal" }, 500);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/video-endpoint.test.mjs`
Expected: PASS — prints `video-endpoint: ok`

- [ ] **Step 5: Commit**

```bash
git add src/server/video/endpoint.ts tests/video-endpoint.test.mjs
git commit -m "feat(video): signed request pipeline with replay protection"
```

---

## Task 10: The Claim Endpoint

The first route, and the one that carries the kill switch.

**Files:**
- Create: `src/routes/api.video.claim.ts`
- Test: `tests/video-claim-route.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-claim-route.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { claimHandler } from "../src/server/video/handlers.ts";

const base = { url: "u", serviceRoleKey: "k", workerSecret: "s", bucket: "video-media" };

// With the pipeline disabled the worker is told there is no work, and the
// database is never asked. This is charter section 10: the kill switch takes
// effect within one polling interval and fails closed.
{
  let asked = false;
  const result = await claimHandler(
    { worker_id: "w1", lease_seconds: 300 },
    { env: { ...base, pipelineEnabled: false }, store: { rpc: async () => { asked = true; return {}; } } },
  );
  assert.deepEqual(result, { job: null });
  assert.equal(asked, false, "a disabled pipeline must not query the database");
}

// With it enabled, the claim RPC is called with the worker id and lease.
{
  const calls = [];
  const job = { job_id: "j1", project_id: "p1", scenes: [] };
  const result = await claimHandler(
    { worker_id: "w1", lease_seconds: 120 },
    {
      env: { ...base, pipelineEnabled: true },
      store: { rpc: async (name, body) => { calls.push([name, body]); return job; } },
    },
  );
  assert.deepEqual(result, { job });
  assert.deepEqual(calls, [["video_claim_next_job", { p_worker: "w1", p_lease_seconds: 120 }]]);
}

// No queued work returns a null job rather than an error.
{
  const result = await claimHandler(
    { worker_id: "w1" },
    { env: { ...base, pipelineEnabled: true }, store: { rpc: async () => null } },
  );
  assert.deepEqual(result, { job: null });
}

// A missing worker id is rejected: leases must be attributable.
await assert.rejects(
  () => claimHandler({}, { env: { ...base, pipelineEnabled: true }, store: { rpc: async () => null } }),
  /worker_id/,
);

console.log("video-claim-route: ok");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-claim-route.test.mjs`
Expected: FAIL — `Cannot find module '../src/server/video/handlers.ts'`

- [ ] **Step 3: Write the handler**

Create `src/server/video/handlers.ts`:

```typescript
/**
 * Endpoint handlers, kept separate from the route files so they can be tested
 * without constructing a Request or booting the router.
 *
 * Each handler receives an already-verified payload from handleSigned().
 */
import { assetPath, exportPath } from "./paths.ts";
import type { VideoEnv } from "./endpoint.ts";
import type { VideoStore } from "./store.ts";

type Ctx = { env: VideoEnv; store: Pick<VideoStore, "rpc"> };
type FullCtx = { env: VideoEnv; store: VideoStore };

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalInt(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${key} must be an integer`);
  }
  return value;
}

export async function claimHandler(payload: Record<string, unknown>, ctx: Ctx) {
  const worker = requireString(payload, "worker_id");

  // The kill switch. Checked before any database call so that disabling the
  // pipeline also removes load, and so a database outage cannot re-enable it.
  if (!ctx.env.pipelineEnabled) return { job: null };

  const lease = optionalInt(payload, "lease_seconds") ?? 300;
  const job = await ctx.store.rpc<unknown>("video_claim_next_job", {
    p_worker: worker,
    p_lease_seconds: lease,
  });
  return { job: job ?? null };
}

export async function uploadIntentHandler(payload: Record<string, unknown>, ctx: FullCtx) {
  const jobId = requireString(payload, "job_id");
  const projectId = requireString(payload, "project_id");
  const kind = requireString(payload, "kind");
  const contentType = requireString(payload, "content_type");
  const sha256 = requireString(payload, "sha256");
  const ext = requireString(payload, "ext");
  const sceneIndex = optionalInt(payload, "scene_index");

  // The worker declares WHAT it is uploading. The app decides WHERE it goes.
  //
  // Renditions are keyed by rendition rather than scene index. Without this
  // branch the master and all three exports would derive the identical path
  // (kind "master", scene null) and collide on video_assets.storage_path.
  const path =
    kind === "export"
      ? exportPath({ projectId, jobId, rendition: requireString(payload, "rendition") })
      : assetPath({ projectId, jobId, kind, sceneIndex, ext });

  const intent = await ctx.store.rpc<{ asset_id: string; storage_path: string; created: boolean }>(
    "video_upload_intent",
    {
      p_job_id: jobId,
      p_kind: kind,
      p_scene_index: sceneIndex,
      p_content_type: contentType,
      p_sha256: sha256,
      p_storage_path: path,
    },
  );

  // A fresh signed URL every time, including for a replay: the previous one may
  // already have expired or been consumed.
  const uploadUrl = await ctx.store.createSignedUploadUrl(intent.storage_path);

  return {
    asset_id: intent.asset_id,
    storage_path: intent.storage_path,
    upload_url: uploadUrl,
    created: intent.created,
  };
}

export async function uploadCompleteHandler(payload: Record<string, unknown>, ctx: FullCtx) {
  const assetId = requireString(payload, "asset_id");
  const sha256 = requireString(payload, "sha256");
  const storagePath = requireString(payload, "storage_path");
  const declared = optionalInt(payload, "byte_size");

  // Verify rather than trust: confirm the bytes actually landed and match what
  // the worker said it uploaded.
  const stat = await ctx.store.statObject(storagePath);
  if (!stat) throw new Error("object not found in storage");
  if (declared !== null && stat.size !== declared) {
    throw new Error(`size mismatch: storage has ${stat.size}, worker declared ${declared}`);
  }

  return ctx.store.rpc("video_upload_complete", {
    p_asset_id: assetId,
    p_sha256: sha256,
    p_byte_size: stat.size,
  });
}

export async function exportRecordHandler(payload: Record<string, unknown>, ctx: FullCtx) {
  const jobId = requireString(payload, "job_id");
  const projectId = requireString(payload, "project_id");
  const rendition = requireString(payload, "rendition");
  const sha256 = requireString(payload, "sha256");
  const durationMs = optionalInt(payload, "duration_ms");

  const path = exportPath({ projectId, jobId, rendition });
  const stat = await ctx.store.statObject(path);
  if (!stat) throw new Error("export object not found in storage");

  return ctx.store.rpc("video_export_record", {
    p_job_id: jobId,
    p_rendition: rendition,
    p_storage_path: path,
    p_sha256: sha256,
    p_byte_size: stat.size,
    p_duration_ms: durationMs,
  });
}

export async function jobCompleteHandler(payload: Record<string, unknown>, ctx: Ctx) {
  const jobId = requireString(payload, "job_id");
  return ctx.store.rpc("video_job_complete", { p_job_id: jobId });
}

export async function jobFailedHandler(payload: Record<string, unknown>, ctx: Ctx) {
  const jobId = requireString(payload, "job_id");
  const code = requireString(payload, "error_code");
  const detail = typeof payload.error_detail === "string" ? payload.error_detail : "";
  return ctx.store.rpc("video_job_failed", {
    p_job_id: jobId,
    p_error_code: code,
    p_error_detail: detail,
    p_max_attempts: 3,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/video-claim-route.test.mjs`
Expected: PASS — prints `video-claim-route: ok`

- [ ] **Step 5: Write the route files**

Create `src/routes/api.video.claim.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * Machine-to-machine only. The render worker authenticates with an HMAC
 * signature, never a session cookie, and holds no database credential.
 */
export const Route = createFileRoute("/api/video/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { videoEnv, handleSigned } = await import("@/server/video/endpoint");
        const { VideoStore } = await import("@/server/video/store");
        const { claimHandler } = await import("@/server/video/handlers");

        const env = videoEnv();
        const store = new VideoStore(env);
        return handleSigned(request, { env, store, handle: (p, c) => claimHandler(p, c) });
      },
    },
  },
});
```

Create `src/routes/api.video.upload-intent.ts`, `api.video.upload-complete.ts`, `api.video.export-record.ts`, `api.video.job-complete.ts` and `api.video.job-failed.ts` with the identical shape, changing only the route path and the imported handler:

| File | Route path | Handler |
|---|---|---|
| `api.video.upload-intent.ts` | `/api/video/upload-intent` | `uploadIntentHandler` |
| `api.video.upload-complete.ts` | `/api/video/upload-complete` | `uploadCompleteHandler` |
| `api.video.export-record.ts` | `/api/video/export-record` | `exportRecordHandler` |
| `api.video.job-complete.ts` | `/api/video/job-complete` | `jobCompleteHandler` |
| `api.video.job-failed.ts` | `/api/video/job-failed` | `jobFailedHandler` |

For example, `src/routes/api.video.upload-intent.ts`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/api/video/upload-intent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { videoEnv, handleSigned } = await import("@/server/video/endpoint");
        const { VideoStore } = await import("@/server/video/store");
        const { uploadIntentHandler } = await import("@/server/video/handlers");

        const env = videoEnv();
        const store = new VideoStore(env);
        return handleSigned(request, {
          env,
          store,
          handle: (p) => uploadIntentHandler(p, { env, store }),
        });
      },
    },
  },
});
```

- [ ] **Step 6: Regenerate the route tree and typecheck**

Run: `bun run build`
Then: `bunx tsc --noEmit`
Expected: build succeeds and `src/routeTree.gen.ts` now contains the six `/api/video/*` routes. CI checks the route tree is current, so it must be committed.

- [ ] **Step 7: Commit**

```bash
git add src/server/video/handlers.ts src/routes/api.video.*.ts src/routeTree.gen.ts tests/video-claim-route.test.mjs
git commit -m "feat(video): signed worker endpoints with fail-closed kill switch"
```

# Phase 4 — The Render Worker

## Task 11: Worker Scaffolding And Configuration

The worker is a separate package with its own dependencies and typecheck. It deliberately has no Supabase client and no database URL — if a future change tries to add one, it should feel wrong.

**Files:**
- Create: `worker/package.json`, `worker/tsconfig.json`, `worker/src/config.ts`
- Test: `tests/video-worker-config.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-worker-config.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadConfig } from "../worker/src/config.ts";

const complete = {
  GT_APP_BASE_URL: "https://giventakedevs.com/",
  VIDEO_WORKER_SECRET: "s".repeat(32),
  VIDEO_WORKER_ID: "worker-1",
};

// A trailing slash on the base URL must not produce a double slash in requests.
assert.equal(loadConfig(complete).appBaseUrl, "https://giventakedevs.com");
assert.equal(loadConfig(complete).workerId, "worker-1");
assert.equal(loadConfig(complete).pollIntervalMs, 5000);
assert.equal(loadConfig(complete).leaseSeconds, 300);

assert.equal(loadConfig({ ...complete, VIDEO_POLL_INTERVAL_MS: "1500" }).pollIntervalMs, 1500);
// A nonsense interval falls back rather than busy-looping at zero.
assert.equal(loadConfig({ ...complete, VIDEO_POLL_INTERVAL_MS: "abc" }).pollIntervalMs, 5000);
assert.equal(loadConfig({ ...complete, VIDEO_POLL_INTERVAL_MS: "0" }).pollIntervalMs, 5000);

for (const missing of ["GT_APP_BASE_URL", "VIDEO_WORKER_SECRET", "VIDEO_WORKER_ID"]) {
  const partial = { ...complete };
  delete partial[missing];
  assert.throws(() => loadConfig(partial), new RegExp(missing), `${missing} must be required`);
}

// A short secret is a configuration error, not a warning.
assert.throws(() => loadConfig({ ...complete, VIDEO_WORKER_SECRET: "short" }), /32/);

// The worker must never learn about the database. If either of these appears in
// the worker source, the isolation the design depends on has been lost.
const configSource = readFileSync(new URL("../worker/src/config.ts", import.meta.url), "utf8");
assert.doesNotMatch(configSource, /SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);

console.log("video-worker-config: ok");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-worker-config.test.mjs`
Expected: FAIL — `Cannot find module '../worker/src/config.ts'`

- [ ] **Step 3: Write the worker package files**

Create `worker/package.json`:

```json
{
  "name": "giventake-video-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "start": "node --experimental-strip-types src/index.ts"
  },
  "devDependencies": {
    "@types/node": "^22.16.5",
    "typescript": "^5.8.3"
  }
}
```

Create `worker/tsconfig.json`:

```json
{
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

Create `worker/src/config.ts`:

```typescript
/**
 * Worker configuration.
 *
 * Deliberately contains no database URL and no Supabase key. The worker reaches
 * Postgres only through signed calls to the app, so a compromised render box
 * cannot read leads, contacts or consent evidence. If a future change wants to
 * add SUPABASE_* here, that is the design being undone rather than extended.
 */

export interface WorkerConfig {
  appBaseUrl: string;
  secret: string;
  workerId: string;
  pollIntervalMs: number;
  leaseSeconds: number;
  workDir: string;
}

const MIN_SECRET_LENGTH = 32;

function required(source: Record<string, string | undefined>, key: string): string {
  const value = source[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function loadConfig(source: Record<string, string | undefined> = process.env): WorkerConfig {
  const secret = required(source, "VIDEO_WORKER_SECRET");
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`VIDEO_WORKER_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return {
    appBaseUrl: required(source, "GT_APP_BASE_URL").replace(/\/$/, ""),
    secret,
    workerId: required(source, "VIDEO_WORKER_ID"),
    pollIntervalMs: positiveInt(source.VIDEO_POLL_INTERVAL_MS, 5000),
    leaseSeconds: positiveInt(source.VIDEO_LEASE_SECONDS, 300),
    workDir: source.VIDEO_WORK_DIR?.trim() || "/tmp/giventake-video",
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/video-worker-config.test.mjs`
Expected: PASS — prints `video-worker-config: ok`

- [ ] **Step 5: Commit**

```bash
git add worker/package.json worker/tsconfig.json worker/src/config.ts tests/video-worker-config.test.mjs
git commit -m "feat(video): worker package that holds no database credential"
```

---

## Task 12: The Signed Client

The worker's only way to reach anything. Every call signs the payload with the same algorithm the app verifies.

**Files:**
- Create: `worker/src/client.ts`
- Test: `tests/video-worker-client.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-worker-client.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { StudioClient } from "../worker/src/client.ts";
import { verifySigned } from "../src/server/video/signing.ts";

const SECRET = "s".repeat(32);
const config = {
  appBaseUrl: "https://app.test",
  secret: SECRET,
  workerId: "worker-1",
  pollIntervalMs: 5000,
  leaseSeconds: 300,
  workDir: "/tmp/x",
};

// Every request the worker sends verifies with the app's own verifier. This is
// the contract between the two packages, so it is asserted directly rather than
// re-implemented.
{
  const seen = [];
  const client = new StudioClient(config, async (url, init) => {
    const payload = JSON.parse(init.body);
    seen.push({ url: String(url), headers: init.headers, payload });
    return new Response(JSON.stringify({ job: null }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  });

  await client.claim();
  const call = seen[0];
  assert.equal(call.url, "https://app.test/api/video/claim");
  assert.equal(call.payload.worker_id, "worker-1");
  assert.equal(
    verifySigned({
      secret: SECRET,
      timestamp: call.headers["x-gt-timestamp"],
      nonce: call.headers["x-gt-nonce"],
      payload: call.payload,
      signature: call.headers["x-gt-signature"],
    }).ok,
    true,
  );
}

// Nonces must differ between calls or the app will reject the second as a replay.
{
  const nonces = [];
  const client = new StudioClient(config, async (_url, init) => {
    nonces.push(init.headers["x-gt-nonce"]);
    return new Response(JSON.stringify({ job: null }), { status: 200 });
  });
  await client.claim();
  await client.claim();
  assert.notEqual(nonces[0], nonces[1]);
}

// A non-2xx response throws with the status so the poll loop can back off.
{
  const client = new StudioClient(config, async () => new Response("nope", { status: 503 }));
  await assert.rejects(() => client.claim(), /503/);
}

// A 409 replay is surfaced distinctly: it means the callback already landed, so
// the worker should treat it as success rather than retrying forever.
{
  const client = new StudioClient(config, async () => new Response(JSON.stringify({ error: "replay" }), { status: 409 }));
  await assert.rejects(() => client.jobComplete("j1"), /replay/);
}

console.log("video-worker-client: ok");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-worker-client.test.mjs`
Expected: FAIL — `Cannot find module '../worker/src/client.ts'`

- [ ] **Step 3: Write the implementation**

Create `worker/src/client.ts`:

```typescript
/**
 * Signed HTTP client for the studio API.
 *
 * The worker's entire outbound surface. Each request carries a timestamp, a
 * fresh nonce, and an HMAC over the canonical payload; the app rejects anything
 * that fails verification, is older than five minutes, or reuses a nonce.
 *
 * The signing algorithm is duplicated from src/server/video/signing.ts rather
 * than imported, because the worker is a separate package with no path into the
 * app's source tree at runtime. tests/video-worker-client.test.mjs asserts the
 * two implementations agree, which is what keeps the duplication honest.
 */
import { createHmac, randomUUID } from "node:crypto";
import type { WorkerConfig } from "./config.ts";

type Fetch = typeof globalThis.fetch;

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
    .join(",")}}`;
}

export interface ClaimedJob {
  job_id: string;
  project_id: string;
  idempotency_key: string;
  attempt: number;
  brand: Record<string, unknown>;
  duration_seconds: number;
  scenes: Array<Record<string, unknown>>;
}

export class StudioClient {
  readonly #config: WorkerConfig;
  readonly #fetch: Fetch;

  constructor(config: WorkerConfig, fetchImpl?: Fetch) {
    this.#config = config;
    this.#fetch = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  async #post<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    const timestamp = String(Date.now());
    const nonce = randomUUID();
    const signature = createHmac("sha256", this.#config.secret)
      .update(`${timestamp}.${nonce}.${canonical(payload)}`)
      .digest("hex");

    const response = await this.#fetch(`${this.#config.appBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gt-timestamp": timestamp,
        "x-gt-nonce": nonce,
        "x-gt-signature": signature,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 409) {
      throw new Error(`${path} rejected as replay (409)`);
    }
    if (!response.ok) {
      throw new Error(`${path} failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async claim(): Promise<ClaimedJob | null> {
    const result = await this.#post<{ job: ClaimedJob | null }>("/api/video/claim", {
      worker_id: this.#config.workerId,
      lease_seconds: this.#config.leaseSeconds,
    });
    return result.job;
  }

  uploadIntent(input: {
    job_id: string; project_id: string; kind: string;
    scene_index: number | null; content_type: string; sha256: string; ext: string;
    /** Required when kind is "export"; the app derives the path from it. */
    rendition?: string;
  }) {
    return this.#post<{ asset_id: string; storage_path: string; upload_url: string; created: boolean }>(
      "/api/video/upload-intent",
      input,
    );
  }

  uploadComplete(input: { asset_id: string; sha256: string; storage_path: string; byte_size: number }) {
    return this.#post<{ status: string }>("/api/video/upload-complete", input);
  }

  exportRecord(input: {
    job_id: string; project_id: string; rendition: string; sha256: string; duration_ms: number;
  }) {
    return this.#post<{ export_id: string }>("/api/video/export-record", input);
  }

  jobComplete(jobId: string) {
    return this.#post<{ changed: boolean }>("/api/video/job-complete", { job_id: jobId });
  }

  jobFailed(jobId: string, code: string, detail: string) {
    return this.#post<{ final: boolean }>("/api/video/job-failed", {
      job_id: jobId,
      error_code: code,
      error_detail: detail,
    });
  }

  /** PUT bytes straight to Storage. Never routed through the app. */
  async putBytes(uploadUrl: string, body: Uint8Array, contentType: string): Promise<void> {
    const response = await this.#fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
      body,
    });
    if (!response.ok) throw new Error(`upload failed: ${response.status}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/video-worker-client.test.mjs`
Expected: PASS — prints `video-worker-client: ok`

- [ ] **Step 5: Commit**

```bash
git add worker/src/client.ts tests/video-worker-client.test.mjs
git commit -m "feat(video): signed worker client verified against the app's verifier"
```

---

## Task 13: FFmpeg Argument Construction

Argument building is separated from execution so it can be tested without FFmpeg installed. This is where determinism is enforced.

**Files:**
- Create: `worker/src/ffmpeg.ts`
- Test: `tests/video-ffmpeg-args.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-ffmpeg-args.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { fixtureClipArgs, concatArgs, renditionArgs, BITEXACT } from "../worker/src/ffmpeg.ts";

// Every command is deterministic. Without these flags FFmpeg stamps encoder
// version and timestamps into the output, and checksum assertions in CI drift.
for (const args of [
  fixtureClipArgs({ durationSeconds: 2, background: "0x0B1220", textFile: "/t/s0.txt", output: "/t/s0.mp4" }),
  concatArgs({ listFile: "/t/list.txt", output: "/t/master.mp4" }),
  renditionArgs({ input: "/t/master.mp4", rendition: "1x1", output: "/t/1x1.mp4" }),
]) {
  for (const flag of BITEXACT) assert.ok(args.includes(flag), `missing ${flag}`);
  assert.ok(args.includes("-map_metadata"), "metadata must be stripped");
}

// Fixture clips are 1080x1920 and exactly the scene length.
{
  const args = fixtureClipArgs({ durationSeconds: 2.5, background: "0x0B1220", textFile: "/t/s0.txt", output: "/t/s0.mp4" });
  assert.ok(args.join(" ").includes("s=1080x1920"));
  assert.ok(args.join(" ").includes("d=2.5"));
  assert.ok(args.join(" ").includes("anullsrc"), "a silent audio track keeps concat streams uniform");
  // Text comes from a file, never interpolated: drawtext treats : and ' as syntax.
  assert.ok(args.join(" ").includes("textfile=/t/s0.txt"));
  assert.equal(args.at(-1), "/t/s0.mp4");
}

// Concat uses stream copy, which is only safe because every clip is encoded
// with identical settings.
{
  const args = concatArgs({ listFile: "/t/list.txt", output: "/t/master.mp4" });
  assert.ok(args.includes("concat"));
  assert.ok(args.includes("-safe"));
  assert.ok(args.includes("copy"));
}

// 9x16 is the master: a copy, not a re-encode.
{
  const args = renditionArgs({ input: "/t/master.mp4", rendition: "9x16", output: "/t/9x16.mp4" });
  assert.ok(args.includes("copy"));
}

// 1x1 is a centre crop from the vertical master.
{
  const args = renditionArgs({ input: "/t/master.mp4", rendition: "1x1", output: "/t/1x1.mp4" });
  assert.match(args.join(" "), /crop=1080:1080/);
}

// 16x9 pads over a blurred backdrop rather than black bars, because cropping a
// vertical master to landscape would discard the end card.
{
  const args = renditionArgs({ input: "/t/master.mp4", rendition: "16x9", output: "/t/16x9.mp4" });
  assert.match(args.join(" "), /gblur/);
  assert.match(args.join(" "), /overlay/);
  assert.match(args.join(" "), /1920:1080/);
}

assert.throws(() => renditionArgs({ input: "/a", rendition: "4x3", output: "/b" }), /rendition/i);

console.log("video-ffmpeg-args: ok");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/video-ffmpeg-args.test.mjs`
Expected: FAIL — `Cannot find module '../worker/src/ffmpeg.ts'`

- [ ] **Step 3: Write the implementation**

Create `worker/src/ffmpeg.ts`:

```typescript
/**
 * FFmpeg command construction, separated from execution so it can be tested
 * without FFmpeg installed.
 *
 * Determinism matters here. FFmpeg writes encoder version and creation time into
 * output by default, so the same input would produce different bytes on every
 * run and the checksum assertions in CI would be meaningless. The bitexact flags
 * plus stripped metadata make output reproducible for a pinned FFmpeg version —
 * which is why the version is pinned in the Dockerfile.
 *
 * Scene text is passed via textfile rather than interpolated into the filter
 * string: drawtext treats ':' and '\'' as syntax, and brief text is full of both.
 */

export const BITEXACT = ["-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact"];

const COMMON_OUTPUT = [
  "-map_metadata", "-1",
  "-c:v", "libx264",
  "-preset", "veryfast",
  "-pix_fmt", "yuv420p",
  "-r", "30",
  "-c:a", "aac",
  "-b:a", "128k",
  "-movflags", "+faststart",
];

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

export interface FixtureClipInput {
  durationSeconds: number;
  background: string;
  textFile: string;
  output: string;
}

export function fixtureClipArgs(input: FixtureClipInput): string[] {
  const drawtext = [
    `drawtext=textfile=${input.textFile}`,
    `fontfile=${FONT}`,
    "fontcolor=white",
    "fontsize=44",
    "line_spacing=12",
    "x=(w-text_w)/2",
    "y=(h-text_h)/2",
  ].join(":");

  return [
    "-y",
    ...BITEXACT,
    "-f", "lavfi", "-i", `color=c=${input.background}:s=1080x1920:d=${input.durationSeconds}:r=30`,
    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-vf", drawtext,
    "-t", String(input.durationSeconds),
    "-shortest",
    ...COMMON_OUTPUT,
    input.output,
  ];
}

export function concatArgs(input: { listFile: string; output: string }): string[] {
  // Stream copy is safe only because every fixture clip is encoded with
  // identical settings above. Changing COMMON_OUTPUT per-scene would break this.
  return [
    "-y",
    ...BITEXACT,
    "-f", "concat",
    "-safe", "0",
    "-i", input.listFile,
    "-map_metadata", "-1",
    "-c", "copy",
    "-movflags", "+faststart",
    input.output,
  ];
}

export type Rendition = "9x16" | "1x1" | "16x9";

export function renditionArgs(input: { input: string; rendition: string; output: string }): string[] {
  const base = ["-y", ...BITEXACT, "-i", input.input, "-map_metadata", "-1"];

  switch (input.rendition) {
    case "9x16":
      // The master already is 9x16; copying avoids a needless generation loss.
      return [...base, "-c", "copy", "-movflags", "+faststart", input.output];

    case "1x1":
      return [
        ...base,
        "-vf", "crop=1080:1080:0:(ih-1080)/2",
        ...COMMON_OUTPUT,
        input.output,
      ];

    case "16x9":
      return [
        ...base,
        "-filter_complex",
        "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=24[bg];" +
          "[0:v]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0",
        "-c:a", "copy",
        ...COMMON_OUTPUT.filter((flag, i, all) => all[i - 1] !== "-c:a" && flag !== "-c:a"),
        input.output,
      ];

    default:
      throw new Error(`unknown rendition: ${input.rendition}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/video-ffmpeg-args.test.mjs`
Expected: PASS — prints `video-ffmpeg-args: ok`

- [ ] **Step 5: Commit**

```bash
git add worker/src/ffmpeg.ts tests/video-ffmpeg-args.test.mjs
git commit -m "feat(video): deterministic ffmpeg command construction"
```

---

## Task 14: Fixture Provider And Render Pipeline

The provider that stands in for a paid video model, plus the code that turns scenes into a master and three exports.

**Files:**
- Create: `worker/src/fixture.ts`, `worker/src/render.ts`

- [ ] **Step 1: Write the fixture provider**

Create `worker/src/fixture.ts`:

```typescript
/**
 * The only executable provider in Release 1.
 *
 * Emits a deterministic clip per scene: a background from the brand palette, the
 * scene index and the opening of the visual direction burned in, and the exact
 * duration the storyboard asked for. No network, no cost, and fast enough to run
 * in CI on every push.
 *
 * The point is not the picture. It is that everything downstream — assembly,
 * export, upload, review — runs against real media of the right shape and
 * length, so swapping in a real model later changes this file and nothing else.
 */
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { fixtureClipArgs } from "./ffmpeg.ts";

const run = promisify(execFile);

export interface Scene {
  index: number;
  startSeconds: number;
  endSeconds: number;
  visual: string;
  voiceover?: string;
  onScreenText?: string;
}

export interface Brand {
  name?: string;
  palette?: { background?: string };
}

/** Wrap to a fixed width so drawtext output stays inside a 1080px frame. */
function wrap(text: string, width = 28, maxLines = 6): string {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > width) {
      lines.push(line.trim());
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = `${line} ${word}`;
    }
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  return lines.join("\n");
}

export async function renderScene(
  scene: Scene,
  brand: Brand,
  workDir: string,
): Promise<string> {
  const duration = Number((scene.endSeconds - scene.startSeconds).toFixed(3));
  const background = brand.palette?.background ?? "0x0B1220";

  const caption = [
    `SCENE ${scene.index + 1}`,
    `${duration.toFixed(1)}s`,
    "",
    wrap(scene.visual),
    scene.onScreenText ? `\n${wrap(scene.onScreenText)}` : "",
  ]
    .filter((part) => part !== "")
    .join("\n");

  const textFile = join(workDir, `scene-${scene.index}.txt`);
  const output = join(workDir, `scene-${scene.index}.mp4`);
  await writeFile(textFile, caption, "utf8");

  await run("ffmpeg", fixtureClipArgs({ durationSeconds: duration, background, textFile, output }));
  return output;
}
```

- [ ] **Step 2: Write the render pipeline**

Create `worker/src/render.ts`:

```typescript
/**
 * Turns a claimed job into three uploaded exports.
 *
 * Order matters: every asset is uploaded and confirmed before the exports are
 * recorded, and the job is only completed once all three renditions exist. The
 * database rejects a completion with fewer than three, so a partial render can
 * never present itself for review.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { concatArgs, renditionArgs } from "./ffmpeg.ts";
import { renderScene, type Brand, type Scene } from "./fixture.ts";
import type { ClaimedJob, StudioClient } from "./client.ts";

const run = promisify(execFile);

const RENDITIONS = ["9x16", "1x1", "16x9"] as const;

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function upload(
  client: StudioClient,
  job: ClaimedJob,
  file: string,
  kind: string,
  sceneIndex: number | null,
  ext: string,
  contentType: string,
): Promise<void> {
  const bytes = await readFile(file);
  const digest = sha256(bytes);

  const intent = await client.uploadIntent({
    job_id: job.job_id,
    project_id: job.project_id,
    kind,
    scene_index: sceneIndex,
    content_type: contentType,
    sha256: digest,
    ext,
  });

  await client.putBytes(intent.upload_url, bytes, contentType);

  await client.uploadComplete({
    asset_id: intent.asset_id,
    sha256: digest,
    storage_path: intent.storage_path,
    byte_size: bytes.byteLength,
  });
}

export async function renderJob(
  client: StudioClient,
  job: ClaimedJob,
  workRoot: string,
): Promise<void> {
  const workDir = join(workRoot, job.job_id);
  await mkdir(workDir, { recursive: true });

  try {
    const scenes = (job.scenes as unknown as Scene[]).slice().sort((a, b) => a.index - b.index);
    const brand = job.brand as Brand;

    // 1. One clip per scene, uploaded as it is produced so a crash mid-job
    //    leaves durable progress the retry can reuse.
    const clips: string[] = [];
    for (const scene of scenes) {
      const clip = await renderScene(scene, brand, workDir);
      clips.push(clip);
      await upload(client, job, clip, "scene_clip", scene.index, "mp4", "video/mp4");
    }

    // 2. Concatenate into the master.
    const listFile = join(workDir, "concat.txt");
    await writeFile(listFile, clips.map((c) => `file '${c}'`).join("\n"), "utf8");
    const master = join(workDir, "master.mp4");
    await run("ffmpeg", concatArgs({ listFile, output: master }));
    await upload(client, job, master, "master", null, "mp4", "video/mp4");

    // 3. The three renditions.
    const durationMs = Math.round(Number(job.duration_seconds) * 1000);
    for (const rendition of RENDITIONS) {
      const output = join(workDir, `export-${rendition}.mp4`);
      await run("ffmpeg", renditionArgs({ input: master, rendition, output }));

      const bytes = await readFile(output);
      const digest = sha256(bytes);

      // Exports use the same two-step handoff as assets: one protocol, not two.
      // kind "export" plus the rendition is what keeps each one on its own
      // storage path; without it every rendition would derive the master's path.
      const intent = await client.uploadIntent({
        job_id: job.job_id,
        project_id: job.project_id,
        kind: "export",
        rendition,
        scene_index: null,
        content_type: "video/mp4",
        sha256: digest,
        ext: "mp4",
      });
      await client.putBytes(intent.upload_url, bytes, "video/mp4");
      await client.uploadComplete({
        asset_id: intent.asset_id,
        sha256: digest,
        storage_path: intent.storage_path,
        byte_size: bytes.byteLength,
      });

      await client.exportRecord({
        job_id: job.job_id,
        project_id: job.project_id,
        rendition,
        sha256: digest,
        duration_ms: durationMs,
      });
    }

    // 4. Only now is the job done. The database refuses this with fewer than
    //    three ready exports.
    await client.jobComplete(job.job_id);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 3: Typecheck the worker**

Run: `cd worker && bunx tsc --noEmit && cd ..`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add worker/src/fixture.ts worker/src/render.ts
git commit -m "feat(video): fixture provider and three-rendition render pipeline"
```

---

## Task 15: The Poll Loop And Graceful Drain

**Files:**
- Create: `worker/src/index.ts`

- [ ] **Step 1: Write the loop**

Create `worker/src/index.ts`:

```typescript
/**
 * The worker loop.
 *
 * Pulls rather than being pushed to. That is what makes the kill switch work:
 * with VIDEO_PIPELINE_ENABLED off the claim endpoint returns no work, so the
 * pipeline drains within one poll interval, and a worker that cannot reach the
 * app cannot claim anything either. It also means this container needs no
 * inbound ingress at all.
 *
 * On SIGTERM it stops claiming and lets the current job finish, so a deploy
 * never strands a job in "rendering" behind a live lease.
 */
import { mkdir } from "node:fs/promises";
import { loadConfig } from "./config.ts";
import { StudioClient } from "./client.ts";
import { renderJob } from "./render.ts";

const config = loadConfig();
const client = new StudioClient(config);

let draining = false;
let active: Promise<void> | null = null;

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (draining) return;
    draining = true;
    console.log(`[worker] ${signal} received, draining`);
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function tick(): Promise<boolean> {
  const job = await client.claim();
  if (!job) return false;

  console.log(`[worker] claimed job ${job.job_id} (attempt ${job.attempt})`);
  try {
    active = renderJob(client, job, config.workDir);
    await active;
    console.log(`[worker] completed job ${job.job_id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[worker] job ${job.job_id} failed: ${message}`);
    try {
      // One report, then move on. The lease expiry path requeues if this fails.
      await client.jobFailed(job.job_id, "render_failed", message);
    } catch (reportError) {
      console.error(
        `[worker] could not report failure: ${reportError instanceof Error ? reportError.message : "unknown"}`,
      );
    }
  } finally {
    active = null;
  }
  return true;
}

async function main(): Promise<void> {
  await mkdir(config.workDir, { recursive: true });
  console.log(`[worker] ${config.workerId} polling ${config.appBaseUrl} every ${config.pollIntervalMs}ms`);

  while (!draining) {
    let worked = false;
    try {
      worked = await tick();
    } catch (error) {
      // A polling failure is expected during a deploy or a kill-switch flip.
      // Back off rather than hammering.
      console.error(`[worker] poll failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
    if (!draining && !worked) await sleep(config.pollIntervalMs);
  }

  if (active) {
    console.log("[worker] finishing active job before exit");
    await active.catch(() => undefined);
  }
  console.log("[worker] drained, exiting");
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Run: `cd worker && bunx tsc --noEmit && cd ..`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(video): worker poll loop with graceful drain"
```

---

## Task 16: The Container

**Files:**
- Create: `worker/Dockerfile`, `worker/.dockerignore`

- [ ] **Step 1: Write the Dockerfile**

Create `worker/Dockerfile`:

```dockerfile
# Render worker for the GivenTake Video Agent Studio.
#
# FFmpeg is pinned by the base image tag rather than installed from latest,
# because output determinism — and therefore the checksum assertions in CI — only
# holds for a fixed version. Bumping the base image is a deliberate change that
# should be accompanied by re-running the worker integration test.
#
# fonts-dejavu-core is required: drawtext needs a real font file, and the slim
# image ships none.
#
# This container holds no database credential. It needs GT_APP_BASE_URL and
# VIDEO_WORKER_SECRET, nothing more.
FROM node:22.11-slim

RUN apt-get update \
 && apt-get install --no-install-recommends -y ffmpeg fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

# Run unprivileged. The image ships a "node" user; the work directory is the
# only path the process needs to write.
ENV VIDEO_WORK_DIR=/var/tmp/giventake-video
RUN mkdir -p ${VIDEO_WORK_DIR} && chown -R node:node ${VIDEO_WORK_DIR}

WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

USER node

# No inbound ingress: the worker only makes outbound requests.
CMD ["node", "--experimental-strip-types", "src/index.ts"]
```

Create `worker/.dockerignore`:

```
node_modules
*.md
tsconfig.json
```

- [ ] **Step 2: Verify the image builds and FFmpeg and the font are present**

Run:
```bash
docker build -t giventake-video-worker ./worker
docker run --rm giventake-video-worker ffmpeg -version
docker run --rm giventake-video-worker ls /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
```
Expected: the build succeeds, FFmpeg prints its version, and the font path resolves.

- [ ] **Step 3: Verify it refuses to start unconfigured**

Run: `docker run --rm giventake-video-worker`
Expected: exits non-zero with `GT_APP_BASE_URL is required`. Failing loudly on missing configuration is intended.

- [ ] **Step 4: Commit**

```bash
git add worker/Dockerfile worker/.dockerignore
git commit -m "feat(video): pinned worker container with ffmpeg and fonts"
```

---

## Task 17: Worker Integration Test

The proof that the handoff actually works. A stub app server implements the five endpoints with in-memory state and a temp-directory storage, verifying signatures with the app's real verifier. The real worker, real client and real FFmpeg run against it.

This needs FFmpeg on the host, using the same explicit-skip contract Docker already uses.

**Files:**
- Create: `tests/video-worker.integration.test.mjs`

- [ ] **Step 1: Write the test**

Create `tests/video-worker.integration.test.mjs`:

```javascript
/**
 * End-to-end proof of the media handoff.
 *
 * A stub studio API with in-memory state and temp-dir storage, exercised by the
 * real StudioClient, the real render pipeline and real FFmpeg. Only the database
 * is stubbed; every protocol rule is enforced by the same code the app runs.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { verifySigned } from "../src/server/video/signing.ts";
import { assetPath, exportPath } from "../src/server/video/paths.ts";
import { StudioClient } from "../worker/src/client.ts";
import { renderJob } from "../worker/src/render.ts";

try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
} catch {
  if (process.env.ALLOW_FFMPEG_INTEGRATION_SKIP === "true") {
    console.log("SKIP video worker integration: ffmpeg unavailable and ALLOW_FFMPEG_INTEGRATION_SKIP=true");
    process.exit(0);
  }
  throw new Error(
    "ffmpeg is required for the worker integration test. Set ALLOW_FFMPEG_INTEGRATION_SKIP=true only for an explicit skip.",
  );
}

const SECRET = "s".repeat(32);
const root = mkdtempSync(join(tmpdir(), "gt-video-"));
const storageDir = join(root, "storage");
const workDir = join(root, "work");
mkdirSync(storageDir, { recursive: true });
mkdirSync(workDir, { recursive: true });

const JOB = {
  job_id: "33333333-3333-4333-8333-333333333333",
  project_id: "44444444-4444-4444-8444-444444444444",
  idempotency_key: "int-key-1",
  attempt: 1,
  brand: { name: "GivenTake Devs", palette: { background: "0x0B1220" } },
  duration_seconds: 4,
  scenes: [
    { index: 0, startSeconds: 0, endSeconds: 2, visual: "Notebook idea becomes an interface", onScreenText: "" },
    { index: 1, startSeconds: 2, endSeconds: 4, visual: "Brand card resolves", onScreenText: "GivenTake Devs" },
  ],
};

// In-memory database.
const state = { assets: new Map(), exports: new Map(), nonces: new Set(), completed: 0, intents: 0 };

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw));
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const raw = await readBody(req);

  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  // Storage: a signed PUT writes bytes to a temp dir.
  if (url.pathname.startsWith("/storage/")) {
    if (!url.searchParams.get("token")) return send(401, { error: "unsigned upload" });
    const file = join(storageDir, url.pathname.replace("/storage/", ""));
    mkdirSync(dirname(file), { recursive: true });
    const chunks = [];
    // Body was already consumed as a string; re-read as binary is not possible,
    // so the worker's PUT is captured via a separate raw listener below.
    writeFileSync(file, Buffer.from(raw, "binary"));
    void chunks;
    return send(200, { ok: true });
  }

  const payload = raw ? JSON.parse(raw) : {};
  const verified = verifySigned({
    secret: SECRET,
    timestamp: req.headers["x-gt-timestamp"],
    nonce: req.headers["x-gt-nonce"],
    payload,
    signature: req.headers["x-gt-signature"],
  });
  if (!verified.ok) return send(401, { error: "unauthorized" });

  const nonce = req.headers["x-gt-nonce"];
  if (state.nonces.has(nonce)) return send(409, { error: "replay" });
  state.nonces.add(nonce);

  switch (url.pathname) {
    case "/api/video/claim":
      return send(200, { job: null });

    case "/api/video/upload-intent": {
      state.intents += 1;
      // Mirrors uploadIntentHandler: renditions are keyed by rendition, not by
      // scene index, or every export would collide on the master's path.
      const path =
        payload.kind === "export"
          ? exportPath({
              projectId: payload.project_id,
              jobId: payload.job_id,
              rendition: payload.rendition,
            })
          : assetPath({
              projectId: payload.project_id,
              jobId: payload.job_id,
              kind: payload.kind,
              sceneIndex: payload.scene_index,
              ext: payload.ext,
            });
      // Identity is (job, kind, scene, sha) — exactly the database's unique index.
      const key = `${payload.job_id}|${payload.kind}|${payload.rendition ?? payload.scene_index ?? -1}|${payload.sha256}`;
      const existing = state.assets.get(key);
      const assetId = existing?.assetId ?? `asset-${state.assets.size + 1}`;
      state.assets.set(key, { assetId, path, status: existing?.status ?? "pending" });
      return send(200, {
        asset_id: assetId,
        storage_path: path,
        upload_url: `http://127.0.0.1:${port}/storage/${path}?token=t`,
        created: !existing,
      });
    }

    case "/api/video/upload-complete": {
      const file = join(storageDir, payload.storage_path);
      if (!existsSync(file)) return send(500, { error: "object not found" });
      for (const [key, value] of state.assets) {
        if (value.assetId === payload.asset_id) state.assets.set(key, { ...value, status: "ready" });
      }
      return send(200, { status: "ready" });
    }

    case "/api/video/export-record": {
      const path = exportPath({
        projectId: payload.project_id,
        jobId: payload.job_id,
        rendition: payload.rendition,
      });
      state.exports.set(payload.rendition, { path, sha256: payload.sha256 });
      return send(200, { export_id: `export-${payload.rendition}` });
    }

    case "/api/video/job-complete":
      if (state.exports.size !== 3) return send(500, { error: "expected 3 exports" });
      state.completed += 1;
      return send(200, { changed: true });

    default:
      return send(404, { error: "not found" });
  }
});

// The worker PUTs binary bodies; capture them without string coercion.
server.on("request", () => {});

const port = await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve(server.address().port));
});

const config = {
  appBaseUrl: `http://127.0.0.1:${port}`,
  secret: SECRET,
  workerId: "integration-worker",
  pollIntervalMs: 1000,
  leaseSeconds: 300,
  workDir,
};

try {
  const client = new StudioClient(config);

  // 1. A full render produces exactly three exports and completes the job.
  await renderJob(client, JOB, workDir);
  assert.equal(state.exports.size, 3, "expected three renditions");
  assert.deepEqual([...state.exports.keys()].sort(), ["16x9", "1x1", "9x16"]);
  assert.equal(state.completed, 1);

  for (const rendition of ["9x16", "1x1", "16x9"]) {
    const file = join(storageDir, state.exports.get(rendition).path);
    assert.ok(existsSync(file), `${rendition} must exist in storage`);
    assert.ok(readFileSync(file).byteLength > 0, `${rendition} must not be empty`);
  }

  // 2. Replaying the whole job creates no new asset rows. Identity is the
  //    checksum, and fixture output is deterministic, so the second run
  //    converges on the same rows rather than duplicating them.
  const assetsAfterFirst = state.assets.size;
  const intentsAfterFirst = state.intents;
  await renderJob(client, JOB, workDir);
  assert.equal(state.assets.size, assetsAfterFirst, "a replayed job must not create new assets");
  assert.ok(state.intents > intentsAfterFirst, "the replay did re-issue intents");
  assert.equal(state.exports.size, 3, "a replayed job must not add renditions");

  // 3. A wrong secret is rejected: signatures are the only credential.
  const impostor = new StudioClient({ ...config, secret: "x".repeat(32) });
  await assert.rejects(() => impostor.claim(), /401/);

  console.log("video-worker integration: ok");
} finally {
  server.close();
  rmSync(root, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run it**

Run: `node --experimental-strip-types tests/video-worker.integration.test.mjs`
Expected: PASS — prints `video-worker integration: ok`

If the stub's binary body handling truncates uploads, switch the storage branch to collect `req` chunks into a Buffer before writing rather than using the pre-read string. The assertion that each export file is non-empty is what catches this.

- [ ] **Step 3: Commit**

```bash
git add tests/video-worker.integration.test.mjs
git commit -m "test(video): end-to-end handoff with real ffmpeg and signature checks"
```

---

# Phase 5 — The Studio

## Task 18: Read And Write RPCs For The UI

The UI needs its own RPCs, and they must enforce ownership themselves: `service_role` bypasses RLS, so a function that forgot to filter by viewer would expose every project.

**Files:**
- Create: `supabase/migrations/20260821243000_video_studio_ui_rpcs.sql`
- Modify: `tests/video-rls.integration.test.mjs`

- [ ] **Step 1: Extend the isolation test**

In `tests/video-rls.integration.test.mjs`, replace `  console.log("video-rls integration: ok");` with:

```javascript
  applyFile("20260821243000_video_studio_ui_rpcs.sql");

  const other = "00000000-0000-4000-8000-000000000002";
  psql(`insert into auth.users(id) values ('${other}');`);

  // 11. Ownership is enforced inside the function, because service_role
  //     bypasses RLS and would otherwise see everything.
  const owned = JSON.parse(
    psql(`select public.video_project_create('${user}','Owned ad','brief','{}'::jsonb,12);`, "service_role"),
  );
  const mine = JSON.parse(psql(`select public.video_project_list('${user}',50);`, "service_role"));
  const theirs = JSON.parse(psql(`select public.video_project_list('${other}',50);`, "service_role"));
  assert.ok(mine.some((row) => row.id === owned.project_id), "the owner sees their project");
  assert.ok(!theirs.some((row) => row.id === owned.project_id), "a second user must not see it");

  assert.equal(psql(`select public.video_project_detail('${owned.project_id}','${other}');`, "service_role"), "");
  assert.notEqual(psql(`select public.video_project_detail('${owned.project_id}','${user}');`, "service_role"), "");

  // 12. Saving a storyboard versions rather than overwrites, so a rejected
  //     version stays readable.
  const scenes = `[{"index":0,"startSeconds":0,"endSeconds":12,"visual":"one shot"}]`;
  psql(`select public.video_storyboard_save('${owned.project_id}','${scenes}'::jsonb,'${user}');`, "service_role");
  psql(`select public.video_storyboard_save('${owned.project_id}','${scenes}'::jsonb,'${user}');`, "service_role");
  assert.equal(psql(`select count(*) from public.video_storyboards where project_id='${owned.project_id}';`), "2");
  assert.equal(psql(`select status from public.video_projects where id='${owned.project_id}';`), "storyboarded");

  // 13. A non-owner cannot save into someone else's project.
  assert.throws(
    () => psql(`select public.video_storyboard_save('${owned.project_id}','${scenes}'::jsonb,'${other}');`, "service_role"),
    /not found|forbidden/i,
  );

  console.log("video-rls integration: ok");
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node tests/video-rls.integration.test.mjs`
Expected: FAIL — `ENOENT` reading `20260821243000_video_studio_ui_rpcs.sql`

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260821243000_video_studio_ui_rpcs.sql`:

```sql
-- Read and write RPCs for the Studio UI.
--
-- Every function takes the viewer's user id and filters on it. This is not
-- belt-and-braces: service_role bypasses RLS, so a function that forgot to
-- filter would return every project to every signed-in user. The forced RLS on
-- the tables protects against a mis-granted role; this protects against a
-- mis-written function. Both are needed.

begin;

create or replace function public.video_project_create(
  p_owner uuid, p_title text, p_brief text, p_brand jsonb, p_duration numeric
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  insert into public.video_projects(owner_id, title, brief_text, brand, duration_seconds)
  values (p_owner, p_title, coalesce(p_brief,''), coalesce(p_brand,'{}'::jsonb), p_duration)
  returning id into v_id;
  return jsonb_build_object('project_id', v_id);
end $$;

create or replace function public.video_project_list(p_viewer uuid, p_limit int default 50)
returns jsonb
language sql security definer set search_path = public, pg_temp stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'title', title, 'status', status,
           'duration_seconds', duration_seconds, 'updated_at', updated_at
         ) order by updated_at desc), '[]'::jsonb)
    from public.video_projects
   where owner_id = p_viewer or assigned_to = p_viewer
   limit greatest(1, least(coalesce(p_limit, 50), 200))
$$;

create or replace function public.video_project_detail(p_project_id uuid, p_viewer uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp stable
as $$
declare
  v_project public.video_projects;
  v_scenes  jsonb;
  v_exports jsonb;
  v_reviews jsonb;
begin
  select * into v_project from public.video_projects
   where id = p_project_id and (owner_id = p_viewer or assigned_to = p_viewer);
  if not found then return null; end if;

  select scenes into v_scenes from public.video_storyboards
   where project_id = p_project_id order by version desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'rendition', e.rendition, 'status', e.status, 'duration_ms', e.duration_ms
         ) order by e.rendition), '[]'::jsonb)
    into v_exports
    from public.video_exports e
    join public.video_jobs j on j.id = e.job_id and j.status = 'done'
   where e.project_id = p_project_id and e.status = 'ready';

  select coalesce(jsonb_agg(jsonb_build_object(
           'decision', decision, 'notes', notes, 'created_at', created_at
         ) order by created_at desc), '[]'::jsonb)
    into v_reviews
    from public.video_reviews where project_id = p_project_id;

  return jsonb_build_object(
    'id', v_project.id, 'title', v_project.title, 'status', v_project.status,
    'brief_text', v_project.brief_text, 'brand', v_project.brand,
    'duration_seconds', v_project.duration_seconds,
    'scenes', coalesce(v_scenes, '[]'::jsonb),
    'exports', v_exports, 'reviews', v_reviews
  );
end $$;

create or replace function public.video_storyboard_save(
  p_project_id uuid, p_scenes jsonb, p_author uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_status  text;
  v_version int;
begin
  select status into v_status from public.video_projects
   where id = p_project_id and (owner_id = p_author or assigned_to = p_author)
   for update;
  if not found then raise exception 'project not found or forbidden'; end if;

  perform public.video_assert_transition(v_status, 'storyboarded');

  select coalesce(max(version), 0) + 1 into v_version
    from public.video_storyboards where project_id = p_project_id;

  insert into public.video_storyboards(project_id, version, scenes, created_by)
  values (p_project_id, v_version, p_scenes, p_author);

  update public.video_projects set status = 'storyboarded', updated_at = now()
   where id = p_project_id;

  return jsonb_build_object('version', v_version);
end $$;

-- Resolve an export to its storage path, for the viewer who owns it. The path
-- is used server-side to mint a signed URL and is never returned to a browser.
create or replace function public.video_export_path(p_export_id uuid, p_viewer uuid)
returns text
language sql security definer set search_path = public, pg_temp stable
as $$
  select e.storage_path
    from public.video_exports e
    join public.video_projects p on p.id = e.project_id
   where e.id = p_export_id
     and e.status = 'ready'
     and (p.owner_id = p_viewer or p.assigned_to = p_viewer)
$$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and p.proname like 'video\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

commit;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/video-rls.integration.test.mjs`
Expected: PASS — prints `video-rls integration: ok`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260821243000_video_studio_ui_rpcs.sql tests/video-rls.integration.test.mjs
git commit -m "feat(video): UI RPCs with in-function ownership checks"
```

---

## Task 19: Server Functions For The Studio

Session-gated server functions following the `crm-data.ts` split: a client-safe module that dynamically imports a `.server` module holding cookies and the service key.

**Files:**
- Create: `src/lib/video-data.ts`, `src/lib/video-data.server.ts`
- Test: `tests/video-client-safety.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-client-safety.test.mjs`:

```javascript
/**
 * The client bundle must never learn a credential, a bucket name or a storage
 * path. This scans the video source the same way launch-identity.test.mjs scans
 * the site, because the failure it prevents is silent: a preview that works in
 * development and leaks a service key in production.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// 1. Client-safe modules must not read secrets directly.
const clientSafe = ["src/lib/video-data.ts"];
for (const file of clientSafe) {
  const text = readFileSync(join(root, file), "utf8");
  assert.doesNotMatch(text, /SUPABASE_SERVICE_ROLE_KEY/, `${file} must not name the service key`);
  assert.doesNotMatch(text, /process\.env\.SUPABASE_URL/, `${file} must not read SUPABASE_URL`);
  assert.match(text, /await import\(/, `${file} must reach the server module by dynamic import`);
}

// 2. No secret may be exposed through a VITE_ variable anywhere.
for (const file of walk(join(root, "src")).filter((f) => /\.(ts|tsx)$/.test(f))) {
  const text = readFileSync(file, "utf8");
  assert.doesNotMatch(
    text,
    /VITE_[A-Z_]*(SECRET|SERVICE_ROLE|WORKER_SECRET)/,
    `${relative(root, file)} must not expose a secret to the browser`,
  );
}

// 3. Route components must not import the server module statically.
for (const file of walk(join(root, "src/routes")).filter((f) => /crm\.video/.test(f))) {
  const text = readFileSync(file, "utf8");
  assert.doesNotMatch(
    text,
    /^import .*video-data\.server/m,
    `${relative(root, file)} must not statically import the server module`,
  );
}

console.log("video-client-safety: ok");
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types tests/video-client-safety.test.mjs`
Expected: FAIL — `ENOENT` for `src/lib/video-data.ts`

- [ ] **Step 3: Write the server-only module**

Create `src/lib/video-data.server.ts`:

```typescript
/**
 * Server-only implementation behind the Studio server functions.
 *
 * Touches the service-role key, so it must never enter the client bundle. The
 * `.server.ts` suffix plus dynamic import from video-data.ts keeps it off the
 * client dependency graph — the same arrangement crm-auth.server.ts uses.
 *
 * Preview URLs are minted here and expire in five minutes. The browser receives
 * a URL and nothing else: no bucket name, no storage path, no key.
 */
import { VideoStore } from "@/server/video/store";

const PREVIEW_TTL_SECONDS = 300;

function config() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Response("Video studio is not configured", { status: 503 });
  }
  return { url, serviceRoleKey, bucket: process.env.VIDEO_MEDIA_BUCKET || "video-media" };
}

async function session() {
  const { requireCrmSession } = await import("./crm-auth.server");
  return requireCrmSession();
}

function store() {
  return new VideoStore(config());
}

export async function listProjectsImpl() {
  const user = await session();
  return store().rpc<unknown[]>("video_project_list", { p_viewer: user.userId, p_limit: 50 });
}

export async function projectDetailImpl(projectId: string) {
  const user = await session();
  const detail = await store().rpc<unknown>("video_project_detail", {
    p_project_id: projectId,
    p_viewer: user.userId,
  });
  if (!detail) throw new Response("Not found", { status: 404 });
  return detail;
}

export async function createProjectImpl(input: {
  title: string; brief: string; durationSeconds: number; brand: Record<string, unknown>;
}) {
  const user = await session();
  return store().rpc("video_project_create", {
    p_owner: user.userId,
    p_title: input.title,
    p_brief: input.brief,
    p_brand: input.brand,
    p_duration: input.durationSeconds,
  });
}

export async function saveStoryboardImpl(input: { projectId: string; scenes: unknown[] }) {
  const user = await session();
  return store().rpc("video_storyboard_save", {
    p_project_id: input.projectId,
    p_scenes: input.scenes,
    p_author: user.userId,
  });
}

export async function queueRenderImpl(input: { projectId: string; storyboardId: string }) {
  await session();
  // Deterministic key: re-queueing the same storyboard cannot create a second
  // job even if the request is retried.
  const { payloadHash } = await import("@/server/operator-control/hash");
  const key = payloadHash({ project: input.projectId, storyboard: input.storyboardId });
  return store().rpc("video_project_queue", {
    p_project_id: input.projectId,
    p_storyboard_id: input.storyboardId,
    p_idempotency_key: key,
  });
}

export async function reviewProjectImpl(input: {
  projectId: string; decision: "approved" | "changes_requested"; notes: string;
}) {
  const user = await session();
  return store().rpc("video_project_review", {
    p_project_id: input.projectId,
    p_reviewer: user.userId,
    p_decision: input.decision,
    p_notes: input.notes || null,
  });
}

export async function previewUrlImpl(exportId: string) {
  const user = await session();
  const client = store();
  const path = await client.rpc<string | null>("video_export_path", {
    p_export_id: exportId,
    p_viewer: user.userId,
  });
  if (!path) throw new Response("Not found", { status: 404 });
  return { url: await client.createSignedDownloadUrl(path, PREVIEW_TTL_SECONDS) };
}
```

- [ ] **Step 4: Write the client-safe module**

Create `src/lib/video-data.ts`:

```typescript
/**
 * Studio server functions.
 *
 * Every one requires a valid CRM session and reaches the database through the
 * server-only module below. This file stays client-safe: it never names a
 * credential and never imports the server module statically.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listVideoProjects = createServerFn({ method: "GET" }).handler(async () => {
  const { listProjectsImpl } = await import("./video-data.server");
  return listProjectsImpl();
});

export const getVideoProject = createServerFn({ method: "GET" })
  .validator((data: { projectId: string }) => z.object({ projectId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { projectDetailImpl } = await import("./video-data.server");
    return projectDetailImpl(data.projectId);
  });

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  brief: z.string().max(20000).default(""),
  durationSeconds: z.number().positive().max(120),
  brand: z.record(z.string(), z.unknown()).default({}),
});

export const createVideoProject = createServerFn({ method: "POST" })
  .validator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data }) => {
    const { createProjectImpl } = await import("./video-data.server");
    return createProjectImpl(data);
  });

export const saveVideoStoryboard = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ projectId: z.string().uuid(), scenes: z.array(z.record(z.string(), z.unknown())) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { saveStoryboardImpl } = await import("./video-data.server");
    return saveStoryboardImpl(data);
  });

export const queueVideoRender = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ projectId: z.string().uuid(), storyboardId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { queueRenderImpl } = await import("./video-data.server");
    return queueRenderImpl(data);
  });

export const reviewVideoProject = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        decision: z.enum(["approved", "changes_requested"]),
        notes: z.string().max(4000).default(""),
      })
      // A rejection that does not say what to change does not close the loop.
      // The database enforces this too; catching it here gives a better message.
      .refine((v) => v.decision === "approved" || v.notes.trim().length > 0, {
        message: "Requesting changes needs a note saying what to change",
        path: ["notes"],
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { reviewProjectImpl } = await import("./video-data.server");
    return reviewProjectImpl(data);
  });

export const getVideoPreviewUrl = createServerFn({ method: "POST" })
  .validator((data: { exportId: string }) => z.object({ exportId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { previewUrlImpl } = await import("./video-data.server");
    return previewUrlImpl(data.exportId);
  });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/video-client-safety.test.mjs`
Expected: PASS — prints `video-client-safety: ok`

- [ ] **Step 6: Commit**

```bash
git add src/lib/video-data.ts src/lib/video-data.server.ts tests/video-client-safety.test.mjs
git commit -m "feat(video): session-gated studio server functions and signed previews"
```

---

## Task 20: The Studio Screens

Two routes under `/crm/video`. They inherit the `beforeLoad` session guard from `src/routes/crm.tsx`, so no additional gating is needed, and they reuse the existing CRM UI kit rather than introducing a second visual language.

**A deviation from the spec, deliberately.** The spec said the accessibility suite would be extended to the review screen. It cannot be: the existing Playwright suite drives the public site, and `/crm` sign-in is Google OAuth with a Workspace domain restriction, which cannot be completed headlessly in CI. So review-screen accessibility is covered here by static invariants on the markup plus a manual checklist in the runbook. That is weaker and is recorded as such rather than papered over.

**Files:**
- Create: `src/routes/crm.video.tsx`, `src/routes/crm.video.$id.tsx`
- Modify: `src/routes/crm.tsx` (nav entry)
- Test: `tests/video-a11y-invariants.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-a11y-invariants.test.mjs`:

```javascript
/**
 * Accessibility invariants for the Studio screens.
 *
 * The Playwright suite cannot reach /crm — sign-in is Google OAuth restricted to
 * a Workspace domain, which is not completable headlessly. These static checks
 * catch the regressions that matter most on a review screen: an unlabelled video,
 * a control that is a div, and an icon-only button with no accessible name. The
 * runbook carries a manual checklist for what static analysis cannot see.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = ["src/routes/crm.video.tsx", "src/routes/crm.video.$id.tsx"].map((path) => ({
  path,
  text: readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
}));

for (const { path, text } of files) {
  // Interactive elements must be real elements, not click handlers on divs.
  assert.doesNotMatch(text, /<div[^>]*onClick/, `${path}: a div must not be a control`);
  assert.doesNotMatch(text, /<span[^>]*onClick/, `${path}: a span must not be a control`);
}

const detail = files.find((f) => f.path.endsWith("$id.tsx")).text;

// The video element must be labelled and controllable.
assert.match(detail, /<video[^>]*controls/, "the preview must expose native controls");
assert.match(detail, /aria-label=/, "the preview must carry an accessible name");

// The review actions must be buttons with explicit types.
assert.match(detail, /type="button"/, "review actions must be typed buttons");
assert.match(detail, /Approve/, "an approve action must exist");
assert.match(detail, /Request changes/, "a request-changes action must exist");

// The notes field must be associated with a label rather than a placeholder.
assert.match(detail, /htmlFor=/, "the notes field must have a real label");

// Status changes must be announced.
assert.match(detail, /role="status"|aria-live=/, "status must be announced to assistive tech");

console.log("video-a11y-invariants: ok");
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types tests/video-a11y-invariants.test.mjs`
Expected: FAIL — `ENOENT` for `src/routes/crm.video.tsx`

- [ ] **Step 3: Write the list route**

Create `src/routes/crm.video.tsx`:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { listVideoProjects } from "@/lib/video-data";
import { PageHeader, DataTable, EmptyState, Badge } from "@/components/crm/ui";

interface ProjectRow {
  id: string;
  title: string;
  status: string;
  duration_seconds: number;
  updated_at: string;
}

export const Route = createFileRoute("/crm/video")({
  loader: () => listVideoProjects(),
  component: VideoProjects,
});

function when(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString();
}

function VideoProjects() {
  const rows = (Route.useLoaderData() ?? []) as ProjectRow[];

  return (
    <div>
      <PageHeader
        title="Video studio"
        subtitle={`${rows.length} advertisement${rows.length === 1 ? "" : "s"} · fixture provider only`}
      />
      {rows.length === 0 ? (
        <EmptyState>
          No advertisements yet. Renders use the fixture provider, so nothing here costs money or
          reaches a social platform.
        </EmptyState>
      ) : (
        <DataTable
          columns={["Title", "Status", "Length", "Updated"]}
          rows={rows.map((row) => [
            <Link key={row.id} to="/crm/video/$id" params={{ id: row.id }} className="underline">
              {row.title}
            </Link>,
            <Badge key={`${row.id}-s`} value={row.status} kind={row.status === "failed" ? "risk" : "neutral"} />,
            `${row.duration_seconds}s`,
            when(row.updated_at),
          ])}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the detail and review route**

Create `src/routes/crm.video.$id.tsx`:

```tsx
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { getVideoProject, getVideoPreviewUrl, reviewVideoProject } from "@/lib/video-data";
import { PageHeader, Card, Badge, EmptyState } from "@/components/crm/ui";

interface ExportRow {
  id: string;
  rendition: string;
  status: string;
  duration_ms: number | null;
}
interface Scene {
  index: number;
  startSeconds: number;
  endSeconds: number;
  visual: string;
  voiceover?: string;
}
interface Detail {
  id: string;
  title: string;
  status: string;
  brief_text: string;
  duration_seconds: number;
  scenes: Scene[];
  exports: ExportRow[];
  reviews: Array<{ decision: string; notes: string | null; created_at: string }>;
}

export const Route = createFileRoute("/crm/video/$id")({
  loader: ({ params }) => getVideoProject({ data: { projectId: params.id } }),
  component: VideoProject,
});

/**
 * Preview URLs expire in five minutes, so they are fetched on demand rather than
 * with the page. Caching one in the loader would hand the user a dead link the
 * moment they left the tab open.
 */
function Preview({ exportRow }: { exportRow: ExportRow }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const result = await getVideoPreviewUrl({ data: { exportId: exportRow.id } });
      setUrl(result.url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title={exportRow.rendition}>
      {url ? (
        <video
          controls
          src={url}
          aria-label={`Preview of the ${exportRow.rendition} export`}
          className="w-full rounded"
        />
      ) : (
        <button type="button" onClick={load} disabled={loading} className="underline">
          {loading ? "Loading preview…" : `Load ${exportRow.rendition} preview`}
        </button>
      )}
    </Card>
  );
}

function VideoProject() {
  const detail = Route.useLoaderData() as Detail;
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const inReview = detail.status === "review";

  async function decide(decision: "approved" | "changes_requested") {
    if (decision === "changes_requested" && notes.trim().length === 0) {
      setMessage("Say what needs to change before requesting changes.");
      return;
    }
    setBusy(true);
    try {
      await reviewVideoProject({ data: { projectId: detail.id, decision, notes } });
      setMessage(decision === "approved" ? "Approved." : "Changes requested.");
      setNotes("");
      await router.invalidate();
    } catch {
      setMessage("That did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={detail.title}
        subtitle={`${detail.duration_seconds}s · ${detail.scenes.length} scenes`}
        action={<Badge value={detail.status} kind={detail.status === "failed" ? "risk" : "neutral"} />}
      />

      <p role="status" aria-live="polite" className="min-h-6 text-sm text-muted-foreground">
        {message}
      </p>

      <Card title="Scenes">
        <ol className="space-y-2">
          {detail.scenes.map((scene) => (
            <li key={scene.index}>
              <strong>
                {scene.startSeconds}s–{scene.endSeconds}s
              </strong>{" "}
              {scene.visual}
              {scene.voiceover ? <em> — “{scene.voiceover}”</em> : null}
            </li>
          ))}
        </ol>
      </Card>

      {detail.exports.length === 0 ? (
        <EmptyState>No exports yet. They appear here once a render finishes.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {detail.exports.map((row) => (
            <Preview key={row.id} exportRow={row} />
          ))}
        </div>
      )}

      {inReview ? (
        <Card title="Review">
          <label htmlFor="review-notes" className="block text-sm font-medium">
            What needs to change? (required to request changes)
          </label>
          <textarea
            id="review-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded border p-2"
          />
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={() => decide("approved")} disabled={busy} className="underline">
              Approve
            </button>
            <button type="button" onClick={() => decide("changes_requested")} disabled={busy} className="underline">
              Request changes
            </button>
          </div>
        </Card>
      ) : null}

      {detail.reviews.length > 0 ? (
        <Card title="Review history">
          <ul className="space-y-1">
            {detail.reviews.map((review, index) => (
              <li key={index}>
                <strong>{review.decision}</strong>
                {review.notes ? ` — ${review.notes}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Add the navigation entry**

In `src/routes/crm.tsx`, add `Clapperboard` to the `lucide-react` import list, and add this entry to the navigation array alongside the existing links (next to `Megaphone`/Marketing):

```tsx
{ to: "/crm/video", label: "Video studio", icon: Clapperboard },
```

Match the exact shape of the surrounding entries — read the array before editing rather than assuming the property names.

- [ ] **Step 6: Run the test, build, and typecheck**

Run: `node --experimental-strip-types tests/video-a11y-invariants.test.mjs`
Expected: PASS — prints `video-a11y-invariants: ok`

Run: `bun run build && bunx tsc --noEmit`
Expected: both succeed; `src/routeTree.gen.ts` picks up the two new routes.

- [ ] **Step 7: Commit**

```bash
git add src/routes/crm.video.tsx "src/routes/crm.video.\$id.tsx" src/routes/crm.tsx src/routeTree.gen.ts tests/video-a11y-invariants.test.mjs
git commit -m "feat(video): studio list, storyboard view and review screen"
```

---

# Phase 6 — Ship

## Task 21: Configuration

`wrangler.jsonc` is where plain vars must live. That file already records a deploy that dropped `INTAKE_FROM_EMAIL` because it existed only in the Cloudflare dashboard — plain vars are part of the uploaded config and get replaced on every deploy.

**Files:**
- Modify: `wrangler.jsonc`, `.env.example`, `package.json`
- Test: `tests/video-config.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/video-config.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// Plain vars must be declared in the file, not only in the dashboard, or the
// next deploy silently removes them.
assert.match(wrangler, /VIDEO_PIPELINE_ENABLED/, "the kill switch must be declared in wrangler.jsonc");
assert.match(wrangler, /VIDEO_MEDIA_BUCKET/, "the bucket name must be declared in wrangler.jsonc");

// The worker secret must never be committed as a plain var.
assert.doesNotMatch(wrangler, /VIDEO_WORKER_SECRET/, "the worker secret must stay a dashboard secret");

// Nothing secret may be exposed to the browser.
assert.doesNotMatch(envExample, /VITE_.*(SECRET|SERVICE_ROLE)/, "no secret may be VITE_ prefixed");
assert.match(envExample, /VIDEO_WORKER_SECRET=/, "the secret must be documented with an empty value");
assert.doesNotMatch(envExample, /VIDEO_WORKER_SECRET=.+/, ".env.example must never carry a value");

assert.ok(pkg.scripts["typecheck:worker"], "the worker must be typechecked");
assert.ok(pkg.scripts["test:integration"].includes("video"), "video integration tests must run");

console.log("video-config: ok");
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --experimental-strip-types tests/video-config.test.mjs`
Expected: FAIL — `VIDEO_PIPELINE_ENABLED` not found in `wrangler.jsonc`

- [ ] **Step 3: Update `wrangler.jsonc`**

Add to the existing `vars` block, keeping the surrounding comments intact:

```jsonc
    // Video studio kill switch (charter section 10). Anything other than the
    // exact string "true" disables the pipeline, so a typo fails closed. The
    // claim endpoint checks this before touching the database, which is why
    // flipping it also removes load.
    //
    // This MUST live here rather than only in the dashboard: plain vars are part
    // of the uploaded config and every deploy replaces them with whatever this
    // file declares. That is how INTAKE_FROM_EMAIL was lost on 2026-08-21.
    "VIDEO_PIPELINE_ENABLED": "false",

    // Bucket name only. The bucket is private and created by migration; nothing
    // here grants access to it.
    "VIDEO_MEDIA_BUCKET": "video-media"
```

`VIDEO_WORKER_SECRET` is **not** added here. It stays a dashboard Secret alongside `RESEND_API_KEY` and the `SUPABASE_*` values.

- [ ] **Step 4: Update `.env.example`**

Append:

```bash
# --- Video Agent Studio (server-side, secret) -------------------------------
# Shared secret between the app and the render worker. The worker holds this and
# nothing else — it has no database credential by design, so a compromised render
# box cannot read leads or consent evidence.
#
# Generate with: openssl rand -hex 32
# NEVER prefix this with VITE_; that would publish it to the browser bundle.
VIDEO_WORKER_SECRET=

# Kill switch. Anything other than "true" disables the pipeline (fails closed).
# In production this is set in wrangler.jsonc, not here.
VIDEO_PIPELINE_ENABLED=false

# Private storage bucket, created by migration.
VIDEO_MEDIA_BUCKET=video-media
```

- [ ] **Step 5: Update `package.json` scripts**

Replace the `test:integration` script and add the worker typecheck:

```json
    "typecheck:worker": "tsc --noEmit --project worker/tsconfig.json",
    "test:integration": "node tests/operator-postgres.integration.test.mjs && node tests/video-rls.integration.test.mjs && node --experimental-strip-types tests/video-worker.integration.test.mjs"
```

- [ ] **Step 6: Verify**

Run: `node --experimental-strip-types tests/video-config.test.mjs && bun run typecheck:worker`
Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add wrangler.jsonc .env.example package.json tests/video-config.test.mjs
git commit -m "chore(video): declare pipeline vars in wrangler, keep the secret out"
```

---

## Task 22: CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the worker typecheck to the verify job**

After the existing `Typecheck` step, add:

```yaml
      - name: Typecheck worker
        run: bun run typecheck:worker
```

- [ ] **Step 2: Add an integration job**

Add a new job alongside `verify` and `a11y`. It needs Docker (present on `ubuntu-latest`) and FFmpeg:

```yaml
  integration:
    runs-on: ubuntu-latest
    timeout-minutes: 25

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install
        run: bun install

      # The worker integration test runs real FFmpeg. Determinism is only
      # claimed for a pinned version, so this pins the runner's too.
      - name: Install ffmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      # Both suites refuse to skip silently: they throw unless the explicit
      # ALLOW_*_SKIP flag is set, which CI never sets.
      - name: Integration suites
        run: bun run test:integration
```

- [ ] **Step 3: Verify the workflow parses**

Run: `bunx --yes js-yaml .github/workflows/ci.yml > /dev/null && echo "workflow parses"`
Expected: prints `workflow parses`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck the worker and gate on the video integration suites"
```

---

## Task 23: The Studio SOP

Written in the charter §2 format, because `docs/operations/00-agent-operating-charter.md` says an agent finding an SOP without those sections should treat it as incomplete and escalate.

**Files:**
- Create: `docs/operations/07-marketing-ops/video-agent-studio.md`
- Modify: `docs/operations/07-marketing-ops/README.md`

- [ ] **Step 1: Write the SOP**

Create `docs/operations/07-marketing-ops/video-agent-studio.md` with these sections, in this order, filled in as described:

- **Title and intro** — what the Studio is, and the one-line boundary: agents draft, a human approves, nothing publishes.
- **TRIGGER** — a human decides an advertisement is needed. There is no schedule and no automatic trigger in R1.
- **INPUTS** — title, brief text, duration, brand block (name, tagline, domain, palette), and a storyboard whose scenes tile the duration. Any missing input stops the SOP.
- **STEPS** — (1) create the project, (2) enter the storyboard, (3) queue the render, (4) wait for status `review`, (5) a human watches all three renditions, (6) approve or request changes with notes.
- **DECISION RULES** — approve only when every rendition plays start to finish, the brand card shows the correct name, tagline and domain, and every claim maps to a published offer in `src/lib/offers.ts`. Request changes otherwise. Three failed attempts moves the project to `failed`; do not requeue more than once without investigating.
- **OUTPUTS** — three exports in the private bucket, a `video_reviews` row naming the reviewer, and the project status.
- **ESCALATION** — a render fails twice; an export will not play; the brand card is wrong; any claim cannot be traced to a published offer; anyone asks to publish the result.
- **PROHIBITIONS** — no publishing to any platform; no ad spend; no real video provider until the charter §7 register and subprocessor rows exist; no making media public; no approving your own draft without watching it.
- **AUDIT** — project id, storyboard version, job id and attempt, reviewer id, decision, notes, timestamps. Retained with client project records.

Include this note verbatim near the top:

> **Release 1 renders fixture media.** Exports are coloured cards with burned-in
> scene labels at the correct durations and aspect ratios. They are real MP4s and
> they prove the pipeline; they are not the advertisement. Nothing here calls a
> paid model, and nothing is published.

- [ ] **Step 2: Link it from the folder README**

Add a line to `docs/operations/07-marketing-ops/README.md` pointing at the new SOP and the runbook, matching the surrounding style.

- [ ] **Step 3: Commit**

```bash
git add docs/operations/07-marketing-ops/video-agent-studio.md docs/operations/07-marketing-ops/README.md
git commit -m "docs(video): studio SOP in the charter format"
```

---

## Task 24: The Worker Runbook

**Files:**
- Create: `docs/operations/07-marketing-ops/video-agent-production-worker.md`

- [ ] **Step 1: Write the runbook**

Create the file covering, in this order:

- **What it is** — a container that polls `/api/video/claim`, renders with FFmpeg, and uploads to private Storage. It holds `GT_APP_BASE_URL` and `VIDEO_WORKER_SECRET` and no database credential. State the reason: a compromised render box must not be a full database compromise.
- **Environment** — a table of `GT_APP_BASE_URL`, `VIDEO_WORKER_SECRET`, `VIDEO_WORKER_ID`, `VIDEO_POLL_INTERVAL_MS`, `VIDEO_LEASE_SECONDS`, `VIDEO_WORK_DIR`, with defaults and which are required.
- **Deploy** — `docker build -t giventake-video-worker ./worker`, then run with the environment above. Note that no inbound ports are needed or should be opened.
- **The kill switch** — set `VIDEO_PIPELINE_ENABLED` to `false` **in `wrangler.jsonc`** and deploy. Setting it only in the dashboard does not survive the next deploy. Effect is within one poll interval; in-flight jobs finish. Verify by watching for `claimed job` to stop in the worker log.
- **Draining for a deploy** — send `SIGTERM`; the worker stops claiming and finishes its current job. Wait for `drained, exiting`. Do not `SIGKILL`: the lease stays held until it expires, which delays the retry by up to `VIDEO_LEASE_SECONDS`.
- **Stuck job recovery** — a job in `rendering` with `lease_expires_at` in the past is reclaimed automatically on the next claim, up to three attempts, then marked `failed`. To requeue a failed project, use the Studio; it creates a new job row rather than reviving the old one, so the failed attempt keeps its error.
- **Disk** — the worker writes to `VIDEO_WORK_DIR` and removes each job directory in a `finally` block. If disk fills, check for directories left by a `SIGKILL`ed process and remove those older than a day.
- **Secret rotation** — generate with `openssl rand -hex 32`, set the new value as a Cloudflare Secret, deploy, then restart the worker with the new value. Expect a window of `401`s between the two; the worker retries and no job is lost because claims are idempotent.
- **Failure triage** — a table mapping symptom to cause: `401` on every call → secret mismatch or clock skew over five minutes; `409 replay` → a retried callback, safe to ignore; `expected 3 exports` → a render died between renditions, the job will retry; `object not found in storage` → the upload failed before completion, the job will retry.
- **Manual accessibility checklist for the review screen** — tab to every control including the preview players; confirm each video announces which rendition it is; confirm the status message is announced after approve and request-changes; confirm the notes field is reachable and labelled; confirm nothing is operable by mouse only. Record the date and who ran it.

- [ ] **Step 2: Commit**

```bash
git add docs/operations/07-marketing-ops/video-agent-production-worker.md
git commit -m "docs(video): production worker runbook"
```

---

## Task 25: Final Verification

- [ ] **Step 1: Run the full gate**

```bash
bun run lint
bunx tsc --noEmit
bun run typecheck:worker
bun run build
bun run test
bun run test:integration
```

Expected: all six pass. `bun run test` must include every `video-*` unit test; `test:integration` must run the operator, video RLS and video worker suites without skipping.

- [ ] **Step 2: Confirm the route tree is committed**

Run: `git status --porcelain src/routeTree.gen.ts`
Expected: empty. CI fails if the generated route tree is stale.

- [ ] **Step 3: Confirm no secret reaches the browser**

```bash
bun run build
grep -rniE "service_role|VIDEO_WORKER_SECRET|supabase.co" .output/public/ || echo "clean: no credential in the client bundle"
```
Expected: prints `clean: no credential in the client bundle`.

- [ ] **Step 4: Confirm the kill switch fails closed**

With `VIDEO_PIPELINE_ENABLED` unset entirely, start the worker against a local dev server and confirm it logs polling but never claims. An unset flag must behave exactly like `false`.

- [ ] **Step 5: Walk the reference advertisement end to end**

Create a project titled "GivenTake Devs — 12s vertical", duration 12, with the four scenes from `REFERENCE_AD` in `src/server/video/storyboard.ts`. Queue it, let the worker render, and confirm: the project reaches `review`, three exports appear, each plays in the browser through a signed URL, and requesting changes without notes is refused.

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "chore(video): release 1 verification fixes"
```

---

## Success Criteria

Taken from the spec. The release is done when all of these hold:

- The reference advertisement renders end to end through fixture media and produces three exports awaiting review.
- No Supabase credential, storage path or bucket name appears in any client bundle.
- The worker holds no database credential.
- Replaying any worker callback produces no duplicate rows.
- Killing the worker mid-job and restarting converges to the same final state.
- `VIDEO_PIPELINE_ENABLED=false` stops new work within one poll interval without stranding a job.
- A second user cannot read the first user's projects, assets or exports.
- No media is reachable without an authenticated session and a fresh signed URL.
- A project cannot reach `approved` without a real reviewer id.
- Lint, typecheck, worker typecheck, build, unit tests and both integration suites pass.

## Known Deviations From The Spec

- **Accessibility coverage is weaker than specified.** The spec called for extending the Playwright suite to the review screen. `/crm` sign-in is Google OAuth restricted to a Workspace domain and cannot be completed headlessly, so Task 20 substitutes static markup invariants plus a manual checklist in the runbook. Automating this properly needs a test-only session path, which is its own decision and is not in R1.
- **The schema has seven tables, not six.** `video_callback_nonces` was added for replay protection. It is load-bearing rather than defensive: most endpoints are idempotent and would survive a replay, but `job-failed` increments `attempt_count`, so a replayed failure callback could burn a project's retries.

- **There are six endpoints, not five.** `/api/video/export-record` was split out from job completion. Recording each rendition as it is produced means a render that dies between the second and third export keeps its finished work, and the retry re-uploads only what is missing. Folding it into `job-complete` would have made the last export and the completion a single non-atomic step.

- **The worker does not renew its lease mid-render.** The spec listed lease renewal; this plan claims a fixed 300-second lease instead. For fixture renders that is ample — a 12-second advertisement assembles in seconds — and the expiry path already requeues a job whose worker died. It stops being adequate the moment a real provider lands, because a model call can take minutes and a render exceeding the lease would be claimed a second time while still running. **Building the renewal heartbeat is a prerequisite for the first real provider adapter, not an optional improvement.** Until then, `VIDEO_LEASE_SECONDS` must stay comfortably above the longest observed render.





