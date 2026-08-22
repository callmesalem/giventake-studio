# Video Agent Studio — Media Handoff Design

Date: 2026-08-21

## Purpose

GivenTake Devs needs to produce its own short-form advertisements. Release 1 builds the
durable substrate for that: private media handoff, signed idempotent worker callbacks,
durable assets and exports, authenticated preview, and the human review gate.

Fixture mode is the only executable provider. Nothing in R1 calls a paid video model,
publishes to a social platform, spends ad budget, or serves media publicly. The whole
path runs at zero marginal cost and inside CI.

That constraint is the point rather than a limitation. A pipeline that has only ever run
against one vendor has an untested abstraction; one that runs against a fixture proves
the seam is real before any vendor sits behind it. It also means a provider that is
deprecated, repriced, or replaced costs one adapter rather than a rebuild.

The reference workload is the 12-second vertical GivenTake Devs advertisement: four
beats (0.0–2.0, 2.0–5.0, 5.0–9.0, 9.0–12.0) at 1080x1920, closing on the brand card. R1
renders it with synthetic media. Nothing about the brief changes when a real provider is
added.

This is not the full agent video ecosystem. The creative director, voiceover, music,
captions, continuity checking and publishing are later releases that write to the same
tables this release creates.

## Decision

Build a **pull-based render worker that never holds a database credential**, handing
media over through server-issued signed upload URLs and signed idempotent callbacks.

Five decisions are locked.

**1. The worker pulls; the app never pushes.** The worker polls a claim endpoint and
leases a job row. This is driven by the operating charter, not by taste: §10 requires a
kill switch effective "within one polling interval" that **fails closed**. With a pull
model that is structural — the claim endpoint checks a flag, and a worker that cannot
reach the app cannot claim anything. It also means the worker needs no inbound ingress
and can run behind NAT with no open ports.

**2. The worker holds no Supabase key.** It holds the app base URL and
`VIDEO_WORKER_SECRET`, nothing else. The alternative — giving the worker the
service-role key so it can call PostgREST directly — is fewer moving parts and a much
worse failure mode: that key bypasses RLS on every table, and this database holds leads,
contacts, consent evidence and client personal data. A compromised render box must not
be a full database compromise. Its blast radius is limited to what the `/api/video/*`
endpoints allow.

**3. Ownership follows the existing CRM model.** `owner_id` and `assigned_to` referencing
`auth.users`, `FORCE` row level security, no `anon` or `authenticated` grants, reachable
only through `SECURITY DEFINER` functions that only `service_role` may execute. No
`workspace_id`. Introducing workspace tenancy for the video tables alone would put two
isolation models in one database and make the RLS tests prove a property the rest of the
application does not hold. If the Studio is ever sold to clients, workspaces get
introduced once, everywhere, as a deliberate migration — which is a charter §8 expansion
decision, not an implementation detail.

**4. Generation is faked; assembly is real.** The fixture provider emits deterministic
synthetic source clips. The worker then genuinely concatenates them, overlays the brand
end card, muxes audio, and encodes three renditions with FFmpeg. Only the provider call
is stubbed, so the assembly path that every real render will depend on ships tested.

**5. Human approval is a database constraint, not a convention.**
`video_reviews.reviewer_id` is `not null` and references `auth.users`. An agent cannot
produce an approved project because approval requires a real signed-in user. The site,
`/process` stage 07, `/how-we-use-ai` and MSA §3.2 all promise that nothing ships without
manual human review; this makes that promise enforceable by the database rather than by
discipline.

## Scope

R1 includes:

- A private Supabase Storage bucket for all video media, created by migration.
- Six `video_*` tables with ownership, forced RLS, and no direct grants.
- `SECURITY DEFINER` RPCs as the only access path, executable by `service_role` only.
- Signed HTTP endpoints under `/api/video/*` for claim, upload intent, upload completion,
  job completion and job failure.
- HMAC-SHA256 request signing with replay and clock-skew rejection.
- Idempotency enforced by uniqueness constraints rather than by application logic.
- A containerised render worker with a poll loop, lease renewal and graceful drain.
- A fixture provider producing deterministic synthetic clips.
- Real FFmpeg assembly and three export renditions: 9x16, 1x1, 16x9.
- Authenticated, short-lived signed preview URLs.
- The edit-review state machine, including approve and request-changes.
- Versioned storyboards so a rejected version stays visible.
- A pipeline kill switch that fails closed.
- Unit tests, an RLS/migration integration test, a worker integration test, and
  accessibility coverage of the review screen.
- Deployment configuration and two operations documents.

R1 does not include:

- Any paid or self-hosted video generation provider.
- The LLM creative director that turns a master prompt into a storyboard.
- Voiceover synthesis, music, sound design or captions.
- Continuity checking or automated quality control.
- 15-, 30- or 60-second cuts.
- Publishing, scheduling, or any social platform integration.
- Advertising spend of any kind.
- Public media or unauthenticated access to any asset.
- Workspace tenancy, invitations, or a roles management UI.
- Reopening an approved project.

## Architecture

Three deployables, and the split is forced rather than chosen. The site builds through
Nitro to Cloudflare Workers, which cannot run FFmpeg, native binaries, or a render that
takes minutes. So media production has to live in a container with a real filesystem and
real CPU, and the interesting design problem is the boundary between them.

| Component | Runtime | Holds |
|---|---|---|
| Studio UI and API | TanStack Start on Cloudflare | Supabase service-role key, worker secret |
| Database and Storage | Supabase | All durable state and media |
| Render worker | Docker container, any host | Worker secret and app URL only |

The browser never receives a Supabase credential, a storage path, or a bucket name. This
is already how the CRM works: `.server.ts` modules loaded by dynamic `import()` stay off
the client dependency graph, and server functions return shaped view models rather than
raw responses. The video feature follows that pattern unchanged.

Large media never passes through Cloudflare. The worker uploads bytes directly to Storage
using a signed URL the app mints for a path the app chooses.

## Components

### Database Schema

All tables live in `public`, carry `owner_id uuid references auth.users(id) on delete set
null`, have `FORCE` row level security, and receive no `anon` or `authenticated` grants.

`video_projects` — one advertisement. Holds the brief text, `brand` jsonb, duration,
aspect ratio, status, `owner_id`, `assigned_to`.

The brand block carries name, tagline, domain and palette. It is data rather than
hardcoded strings so the end card reads `GivenTake Devs` / `Your idea. Built.` /
`GivenTakeDevs.com` from a row that can be changed in one place. A reusable brand profile
table is a later release; one project, one brand is sufficient now.

`video_storyboards` — versioned scene lists, `unique (project_id, version)`. Each scene
records index, start and end seconds, visual direction, camera direction, voiceover line,
on-screen text, and per-scene negative constraints. Versions are immutable once created,
so a rejected storyboard remains readable next to its replacement.

`video_jobs` — one render attempt. `unique idempotency_key`, plus `claimed_by`,
`lease_expires_at`, `attempt_count`, `error_code`, `error_detail`.

`video_assets` — per-scene source media. `unique (job_id, kind, scene_index, sha256)`.
Status is `pending` until the bytes are verified present, then `ready`.

`video_exports` — the three renditions. `unique (job_id, rendition)`.

`video_reviews` — append-only human decisions. `reviewer_id` is `not null`.

### HTTP Endpoints

Five routes under `src/routes/api.video.*.ts`, using the `createFileRoute` server handler
pattern already used by `sitemap[.]xml.ts`. All are POST, all require a valid signature,
and none accept a session cookie — they are machine-to-machine only.

| Endpoint | Purpose |
|---|---|
| `/api/video/claim` | Lease the next queued job, or return empty |
| `/api/video/upload-intent` | Register an asset and return a signed upload URL |
| `/api/video/upload-complete` | Verify bytes landed, mark the asset ready |
| `/api/video/job-complete` | Mark the job done and move the project to review |
| `/api/video/job-failed` | Record a failure and requeue or fail the job |

The claim endpoint checks `VIDEO_PIPELINE_ENABLED` before anything else. When the flag is
off it returns empty, so the pipeline drains rather than stalling mid-job.

### Signing And Idempotency

Every request carries `X-GT-Timestamp`, `X-GT-Nonce` and `X-GT-Signature`. The signature
is HMAC-SHA256 over the canonical payload, computed with `canonicalPayload()` from
`src/server/operator-control/hash.ts` — sorted keys, so signatures do not break on
serialisation order. Requests are rejected when the signature fails, when the timestamp is
more than five minutes from server time, or when the nonce has been seen.

Idempotency is a uniqueness constraint rather than a code path, which is what makes it
trustworthy under concurrency. Replaying `upload-intent` returns the same `asset_id` with
a fresh signed URL. Replaying `upload-complete` is a successful no-op. A worker that dies
mid-job and re-claims after its lease expires converges to the same state rather than
producing duplicates.

The worker never chooses the storage path. The app derives it as
`{project_id}/{job_id}/{kind}-{scene_index}.{ext}`, which removes path traversal and
cross-project writes from the threat model entirely.

`upload-complete` verifies rather than trusts: the app confirms the object exists and its
size matches what was declared before flipping status to `ready`.

### The Worker

`worker/` has its own `package.json`, `tsconfig.json` and Dockerfile built on
`node:22-slim` with a pinned FFmpeg. The root `tsconfig.json` includes only `src/**`, so
the worker is already outside the site build — and would therefore go unchecked, which is
why a `typecheck:worker` script and a CI step are part of this release.

The loop claims a job, renews its lease while working, uploads each asset, encodes the
exports, and completes the job. On `SIGTERM` it drains: it finishes the current job or
explicitly releases the lease, so a deploy never strands a job in `rendering` behind a
live lease.

Configuration: `GT_APP_BASE_URL`, `VIDEO_WORKER_SECRET`, `VIDEO_WORKER_ID`,
`VIDEO_POLL_INTERVAL_MS`, `VIDEO_WORK_DIR`.

### Fixture Provider

Produces a clip per scene with a background derived from the brand palette, the scene
index and the opening words of the visual direction burned in, and the exact duration from
the storyboard. A silent audio track of matching length accompanies it. No network access,
no cost, and fast enough to run in CI.

### Assembly And Exports

The master assembles at 1080x1920, the brief's native format. The other renditions derive
from it deterministically: `1x1` at 1080x1080 by centre crop, and `16x9` at 1920x1080
scaled to fit height over a blurred backdrop of itself. Blurred backdrop rather than black
bars, because cropping a 9:16 master to 16:9 would discard most of the frame including the
end card.

Exports travel the same upload-intent and upload-complete protocol as assets. One handoff
protocol, not two.

FFmpeg is pinned in the image and invoked with `-fflags +bitexact`, so output is
reproducible for a given version and checksum assertions are stable in CI. Byte identity
across FFmpeg versions is not claimed; the pin is what makes it hold.

### Studio UI

Routes under `/crm/video`, behind the existing `requireCrmSession()` gate: a project list,
a storyboard editor, and a review screen showing the three renditions with approve and
request-changes actions.

The storyboard editor also carries the queue-render action. It is a server function
rather than a direct write: it validates the storyboard, derives the deterministic
idempotency key, creates the `video_jobs` row, and moves the project to `queued` in one
transaction. Queueing a project that already has a live job is a no-op that returns the
existing job, so a double-click cannot produce two renders.

Preview is a server function that checks the session and ownership, then mints a Supabase
signed URL with a 300-second TTL and returns only that URL. Storage paths, bucket names
and the service-role key never cross to the browser. The short TTL means the UI
re-requests on demand rather than caching a long-lived link.

## Data Flow

1. A human writes the brief and storyboard, then queues a render. The project moves
   `draft` to `storyboarded` to `queued`, and a job row is created with a deterministic
   idempotency key.
2. The worker polls `/api/video/claim`. If `VIDEO_PIPELINE_ENABLED` is off, it gets
   nothing and sleeps. Otherwise it leases the job and the project moves to `rendering`.
3. For each scene the worker generates fixture media, calls `/api/video/upload-intent`,
   PUTs the bytes straight to Storage, and calls `/api/video/upload-complete`.
4. The worker assembles the master, encodes the three renditions, and uploads each by the
   same two-step protocol.
5. The worker calls `/api/video/job-complete`. The project moves to `review`.
6. A human opens the review screen, plays the renditions through short-lived signed URLs,
   and either approves or requests changes with notes.

## State Machine

```
draft -> storyboarded -> queued -> rendering -> review -+-> approved (terminal)
                                       |                +-> changes_requested
                                       +-> failed

back edges:
  changes_requested -> storyboarded   a new storyboard version is saved
  failed            -> queued         the owner requeues; a new job row is created
```

Transitions are enforced inside the RPC against an explicit allowlist, never in the UI
alone. `review -> approved` requires a session user id, which is written to
`video_reviews.reviewer_id`. `review -> changes_requested` requires non-empty notes,
because a rejection that does not say what to change does not close the loop.
`changes_requested -> storyboarded` happens when a new storyboard version is saved.
`approved` freezes the storyboard and exports.

`failed` is recoverable but only deliberately. The owner may requeue a failed project,
which resets `attempt_count` and creates a **new** job row with a new idempotency key
rather than reviving the old one — so the failed attempt stays in the record with its
error, and the retry cannot collide with partially uploaded assets from the attempt
that failed. Requeue is a human action; nothing requeues a failed job automatically.

## Error Handling

A lease that expires returns the job to `queued` and increments `attempt_count`, capped at
three, after which the job is `failed` and the project shows the error. Charter §3.10
limits retries of *client-facing* actions to one; internal rendering is not client-facing,
so a bounded retry is correct, but it is bounded and recorded.

Upload failures leave the asset `pending` and are retried on the next attempt; the
uniqueness constraint means the retry reuses the same row. A signature or skew failure
returns 401 and is audited without the payload.

Every audited event passes through `redact()` from `operator-control/audit.ts`, which
strips token, secret, password, authorization, cookie and API-key fields. `audit()` throws
when the write fails, so an unauditable action does not silently proceed.

## Privacy And Compliance Guardrails

The fixture provider is local, deterministic and processes no personal data, so **R1 adds
no subprocessor and no AI tool register row**. Both become mandatory before any real
provider ships: a row in `docs/contracts/subprocessor-list.md`, a row in
`docs/contracts/ai-tool-register.md`, privacy policy §5 wording, and a signed DPA. That is
a gate on the next release, recorded here so it cannot be forgotten.

Advertisement copy produced through this Studio is bound by charter §6 exactly as the
website is: no outcome metrics without a delivered project and written permission, no
client anecdotes that did not happen, no headcount claims, no capability claims that
cannot be demonstrated. The reference advertisement satisfies this — its four pillars map
to real published offers in `src/lib/offers.ts` (`marketing-site`, `internal-dashboard`
and `mvp-development`, `business-automation`, `ai-lead-intake`).

`VIDEO_WORKER_SECRET` is a dashboard secret. It must never be given a `VITE_` prefix,
which would publish it to the browser bundle.

## Testing

Unit tests as `tests/video-*.test.mjs`, picked up automatically by the existing `test`
script:

- HMAC sign and verify, including replay and clock-skew rejection.
- Idempotency key derivation is stable across key ordering.
- Every illegal state transition is rejected.
- Storyboard schema validation, including scene timing that does not tile the duration.
- Storage path derivation rejects traversal attempts.
- FFmpeg argument construction, as a pure function.

`tests/video-rls.integration.test.mjs`, using the Docker `postgres:17` harness that
`operator-postgres.integration.test.mjs` already establishes:

- `FORCE` RLS is on for every `video_*` table.
- `anon` and `authenticated` hold zero grants on those tables.
- RPC `EXECUTE` is denied to `anon` and `authenticated`.
- A second user cannot read the first user's project through the RPC path.
- Illegal transitions are rejected at the database, not only in application code.

`tests/video-worker.integration.test.mjs`:

- Replayed `upload-intent` and `upload-complete` create no duplicate rows.
- Lease expiry requeues the job and a second attempt converges to the same state.
- Bad signature and stale timestamp are rejected.
- A full fixture render produces exactly three exports and leaves the project in `review`.

Accessibility, extending the existing Playwright suite to the review screen: controls
reachable by keyboard, the video element labelled, focus managed on approve and
request-changes, and axe clean.

## Deployment

`VIDEO_PIPELINE_ENABLED` and `VIDEO_MEDIA_BUCKET` go in `wrangler.jsonc`, not the
Cloudflare dashboard. That file records a deploy that silently dropped
`INTAKE_FROM_EMAIL` because it existed only in the dashboard, reverting the contact form to
its mailto fallback. Plain vars are part of the uploaded config and are replaced on every
deploy by whatever the file declares.

`VIDEO_WORKER_SECRET` stays a dashboard secret, alongside the `SUPABASE_*` values.
`.env.example` gains the non-secret names with empty values.

The storage bucket is created by migration rather than a console click, so it is
reproducible on a fresh project.

Two operations documents accompany this release:
`docs/operations/07-marketing-ops/video-agent-studio.md`, an SOP in the charter §2 format,
and `docs/operations/07-marketing-ops/video-agent-production-worker.md`, a runbook covering
deploy, secret rotation, kill switch, drain, stuck-lease recovery, disk cleanup and failure
triage.

CI gains a worker typecheck step, the worker unit tests, and the two integration jobs,
following the existing `ALLOW_DOCKER_INTEGRATION_SKIP` convention.

## Success Criteria

This release succeeds when:

- The reference advertisement, entered as four scenes, renders end to end through fixture
  media and produces three exports awaiting review.
- No Supabase credential, storage path or bucket name appears in any client bundle.
- The worker holds no database credential.
- Replaying any worker callback produces no duplicate rows.
- Killing the worker mid-job and restarting it converges to the same final state.
- Setting `VIDEO_PIPELINE_ENABLED` to false stops new work within one poll interval
  without leaving a job stranded.
- A second user cannot read the first user's projects, assets or exports.
- No media is reachable without an authenticated session and a fresh signed URL.
- A project cannot reach `approved` without a real reviewer id.
- Lint, typecheck, build, unit tests, both integration suites and the accessibility suite
  pass.

## Open Business Dependencies

None block R1. All block the release after it:

- A chosen video generation provider, with a funded account and a signed DPA.
- Subprocessor list and AI tool register rows for that provider.
- Privacy policy §5 wording covering it.
- A host for the render container with sufficient disk for working files.
- A decision on whether the Studio is ever offered to clients, which is a charter §8
  expansion requiring the published human-review claims to be re-examined first.
