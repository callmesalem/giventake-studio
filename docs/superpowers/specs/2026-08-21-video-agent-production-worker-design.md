# GivenTake Video Agent Production Worker Design

Date: 2026-08-21
Status: Approved by operator delegation

## Purpose

Release B turns the local Studio fixture workflow into a deployable, bounded production-worker foundation. It provides a signed control-plane contract, durable VPS-local job storage, provider polling, explicit cost reservation, deterministic FFmpeg assembly, technical QA, and platform export manifests. It does not turn on a paid provider, public publishing, or the Studio route in production.

## Decision

Three implementation paths were considered:

1. An in-process worker in the TanStack application. This cannot survive Cloudflare request lifetimes or safely host FFmpeg and provider secrets.
2. A Redis/BullMQ queue shared by the web app and VPS. This adds an internet-accessible queue or an extra hosted service before the worker has a persistent application database.
3. A signed HTTP control plane and a VPS-local SQLite lease queue. This is selected. The web application submits a self-contained, signed job; the VPS worker is the only process with provider, storage, and FFmpeg access. SQLite preserves queue state across restarts and exposes an inspectable local source of truth. PostgreSQL will replace the local control-plane persistence in the subsequent persistence release without changing the signed job or renderer contracts.

## Boundaries

### Application control plane

The Studio application creates a `ProductionRenderJob` only after a storyboard approval. It signs a canonical JSON body with `STUDIO_WORKER_SHARED_SECRET` using HMAC-SHA256 and sends it to the worker. The request includes an ISO timestamp and a random request identifier. The worker rejects missing headers, signatures that do not match, timestamps more than five minutes old, invalid schemas, disabled providers, and any job when the outbound kill switch is enabled.

The browser never receives a worker URL, shared secret, provider key, storage key, FFmpeg command, or raw provider response.

### VPS worker service

`services/video-worker` is an independent Node 22+ service. It exposes only:

- `GET /healthz` for deployment health checks, with no secret or job detail.
- `POST /v1/jobs` for a signed enqueue request.
- `GET /v1/jobs/:id` for a signed status request.

The worker persists jobs and attempts in a local SQLite database. It claims work through leases, so a process restart leaves expired leases eligible for recovery. One worker process handles one active job by default. The service has a configurable maximum concurrency but must never start more than that many billable provider attempts at once.

### Job state and retries

Jobs move through `queued`, `leased`, `submitting`, `waiting_for_provider`, `assembling`, `qa_failed`, `completed`, `failed`, or `cancelled`. State changes are append-only attempts with a sanitized diagnostic category. A retry is permitted only for retryable provider or transport failures. The maximum is two retries after the initial attempt. Provider timeout, non-retryable rejection, budget failure, FFmpeg failure, signature failure, and validation failure terminate the job without retrying.

The worker uses a normalized provider poll result: `pending`, `completed`, `failed`, or `cancelled`. Pending is normal polling state, never an exception. The Sora adapter will be updated to honor that contract.

### Spend control

The worker reserves a declared price before sending each scene to a provider. `ProviderCostPolicy` defines a positive cents-per-second rate by provider and model. A job is rejected when the total reservation would exceed its campaign `budgetCents`, even if the provider adapter reports an unknown actual invoice amount. The actual provider cost, when available, is recorded separately; it cannot replace the reservation as the budget gate.

No real provider is selected by default. `fixture` remains the only enabled provider until the VPS configuration explicitly sets a provider, cost policy, worker secret, output directory, and `STUDIO_OUTBOUND_KILL_SWITCH=false`.

### Media and post-production

Provider outputs are raw scene clips. The worker downloads them into a job-local directory and runs FFmpeg only through an injected runner that receives argument arrays, never shell strings. It creates one deterministic assembly plan per profile:

- `vertical`: 1080x1920, 9:16
- `square`: 1080x1080, 1:1
- `landscape`: 1920x1080, 16:9

Every plan applies scale/crop, a safe-area CTA panel, a brand name, an approved URL, and captions generated from the locked storyboard narration. Captions, logo/brand text, URL, and CTA are not delegated to a generative video provider. The worker records an export manifest containing profile, dimensions, output path, expected duration, and checksum.

### Technical QA

FFprobe validates that each export exists, has the expected width and height, contains a video stream, and is within 0.75 seconds of the storyboard duration. A failed check moves the job to `qa_failed` and retains all inputs, output paths, diagnostics, and attempt records for human inspection. It never advances a campaign to edit approval or marketing handoff.

### Security and operations

- Production worker secrets are environment variables and are never logged.
- The worker's data directory is created with owner-only permissions where the host supports them.
- Request diagnostics are sanitized before persistence: no `Authorization`, API keys, signed URLs, or provider payload bodies.
- The health endpoint returns process status and queue counts only.
- Docker packaging installs FFmpeg and runs as a non-root `studio` user. A Compose file binds the worker only to localhost by default; a reverse proxy may expose it privately with TLS.
- The runbook includes environment variables, bootstrap commands, backup paths, recovery behavior, and a smoke test that uses the fixture provider and no real credentials.

## Source layout

- `src/lib/studio/render-job.ts`: shared, server-safe job schemas, provider poll types, cost policies, signing helpers, and export profiles.
- `src/lib/studio/sora-provider.ts`: normalize Sora polling into the shared provider contract.
- `src/lib/studio/production-worker-client.ts`: signed request builder for the application control plane. It is not wired to the public route until authenticated persistence exists.
- `services/video-worker/src/*.mjs`: standalone HTTP server, SQLite repository, lease scheduler, provider registry, FFmpeg planner/runner, probe QA, and worker loop.
- `services/video-worker/Dockerfile` and `docker-compose.yml`: reproducible VPS packaging.
- `tests/video-worker-*.test.mjs`: contract tests for signing, job states, cost limits, provider polling, post-production plans, and a fixture end-to-end worker run.
- `docs/operations/07-marketing-ops/video-agent-production-worker.md`: operator runbook.

## Acceptance criteria

1. Invalid or replayed signed requests cannot enter the queue.
2. A fixture job survives a simulated lease expiry and resumes exactly once.
3. A job that would exceed its reservation budget fails before provider submission.
4. A pending provider result schedules another poll; it does not count as a worker failure.
5. The fixture workflow produces deterministic vertical, square, and landscape assembly plans with captions and required brand/CTA fields.
6. Probe failure prevents completion and preserves the job record.
7. The application build does not include Node worker modules, FFmpeg calls, provider secrets, or the worker shared secret.
8. The VPS service starts with `docker compose up`, exposes a health check, and defaults to the fixture provider and outbound kill switch enabled.

## Non-goals

- Production database/authentication and public Studio enablement.
- Automatic ad publishing, campaign spend, or social account access.
- Avatar, voice-cloning, UGC likeness, or synthetic testimonials.
- Cloud or ComfyUI provider activation; only their adapter boundary and Sora polling normalization are included.
