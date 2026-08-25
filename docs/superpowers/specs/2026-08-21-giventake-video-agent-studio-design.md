# GivenTake Video Agent Studio Design

Date: 2026-08-21
Status: Approved by operator delegation

## Purpose

GivenTake Video Agent Studio turns a campaign brief into reviewed, branded, platform-ready video ad packages. GivenTake Devs is the first tenant and test case. The same system must later support isolated client tenants without exposing one tenant's prompts, assets, provider accounts, costs, or campaign history to another.

The studio is an internal production system. It does not publish social posts, spend advertising budget, impersonate a person, or make a legal/advertising claim without a human approval recorded in the system.

## Product Boundary

The existing public GivenTake application remains the marketing website. The studio is an authenticated private application using the existing React, TanStack Start, TypeScript, Zod, and Tailwind conventions. Long-running generation and rendering run in a separate worker service on Sami's VPS. Browsers never receive provider secrets or direct control over rendering jobs.

The first release creates cinematic, branded 15- and 30-second social advertisements. The architecture also supports 9:16, 1:1, and 16:9 export profiles. Talking-head/UGC avatar generation is a second render mode behind an explicit consent and approval record; it does not block the first useful release.

## User Flow

1. An operator creates a campaign and selects a tenant brand, goal, offer, audience, platforms, duration, CTA, and desired visual style.
2. The Studio Director creates a versioned campaign brief, creative concepts, a script, a visual story bible, and a timed storyboard.
3. The operator approves a selected storyboard and a generation budget before any paid provider request is sent.
4. The worker expands approved scenes into provider-specific generation requests, renders clips, and records every request, result, retry, duration, and cost.
5. Automated QA checks technical requirements and reports continuity, text, audio, and safe-area issues. It may reject a clip for objective technical failure but cannot silently approve a claim or publish an ad.
6. The operator reviews the assembled edit. The worker adds deterministic captions, licensed audio references, brand logo, URL, and CTA overlays, then produces platform exports.
7. Approved exports are handed to the marketing system as drafts with captions, UTM URL, metadata, and audit links. Publishing remains a separate explicit approval.

## Architecture

### Studio Dashboard

The dashboard owns campaign intake, storyboard editing, budget approval, render review, exports, and audit visibility. It talks only to server routes. It uses a versioned API contract so the dashboard and worker can evolve independently.

### Studio API And Persistence

The server-side application stores tenants, brands, campaigns, revisions, scenes, assets, render jobs, provider attempts, QA findings, approvals, exports, and audit events. Production uses managed PostgreSQL with row-level tenant isolation. Development uses a deterministic local repository only when no database credentials are configured.

Every external-effecting request includes an idempotency key. Every tenant-owned record includes `tenant_id`. Every update records actor, timestamp, request ID, previous state, and resulting state.

### Video Production Worker

The worker runs on Sami's VPS, polls or receives queued render jobs, and is the only process allowed to access video-provider credentials, FFmpeg, local ComfyUI endpoints, and object-storage credentials. It implements a queue with bounded concurrency, per-campaign budget enforcement, provider timeouts, retry ceilings, and resumable job states.

The worker is provider-neutral. A `VideoProvider` contract supports submit, poll, cancel, estimate, and normalize-result operations. The first provider is configured by environment variable. An offline fixture provider exists for local integration tests. Cloud and local providers can be added without changing campaign, storyboard, QA, or export code.

### Deterministic Post-production

Generated media is treated as raw footage. The editor assembles approved clips with FFmpeg and applies captions, audio, safe-area layout, logo, URL, CTA, and export sizing deterministically. The system never relies on a generative model to correctly render small brand text or legal copy.

### Agent Roles

The Studio Director is one controlled orchestrator, not a free-form swarm. Its specialist functions produce structured artifacts:

- Creative direction: campaign concepts and creative rationale.
- Script and storyboard: timed scenes, narration, hooks, and CTA placement.
- Prompt engineering: provider-specific prompts derived from the locked story bible.
- Continuity QA: cross-scene checks and clear regeneration reasons.
- Editing QA: duration, resolution, aspect ratio, caption timing, safe areas, and required brand overlay checks.
- Social handoff: captions and publishing drafts only.

Each function has a typed input/output schema. The Studio Director can propose and queue work but may not bypass approval gates.

## Data Model

Core records are:

- `tenants` and `memberships`: ownership and authorization.
- `brands`: display data, approved assets, style tokens, approved CTA domains, and policy constraints.
- `campaigns`: goal, audience, offer, channels, platform profiles, requested durations, CTA, status, and budget ceiling.
- `campaign_revisions`: immutable versioned campaign brief, creative concept, script, story bible, and storyboard.
- `scenes`: ordered timed instructions, narration, prompt data, safe-area reservation, and regeneration lineage.
- `assets`: tenant-scoped media objects with checksum, provenance, rights status, and storage reference.
- `render_jobs` and `render_attempts`: queued work, provider request identifiers, normalized status, cost, and retry detail.
- `qa_findings`: machine findings, severity, evidence, and resolution.
- `approvals`: explicit actor, approval type, approved revision/export, timestamp, and optional note.
- `exports`: output profile, asset references, captions, UTM link, publication readiness, and status.
- `audit_events`: append-only event record for every sensitive action and state change.

## States And Approval Gates

Campaign states are `draft`, `planned`, `awaiting_storyboard_approval`, `approved_for_generation`, `rendering`, `awaiting_edit_approval`, `exported`, `handed_off`, `archived`, and `failed`.

Only a human operator can transition into `approved_for_generation`, `awaiting_edit_approval` completion, or `handed_off`. The service fails closed when it cannot validate authorization, tenant identity, budget, current revision, or approval state.

## Safety And Compliance

- Brand overlays, URLs, and CTAs are added after generation.
- Avatar or voice likeness use requires a recorded consented asset and explicit campaign approval.
- The studio rejects provider requests that exceed budget, attempt limits, allowed domains, allowed providers, or tenant scope.
- Unlicensed music, deceptive claims, fabricated testimonials, and prohibited targeting claims are blocked from export and logged for review.
- Raw media and provider payloads remain tenant-scoped. Secrets never enter the browser, repository, audit log, or client-visible error message.
- A global outbound kill switch prevents new provider submissions, publishing handoff, and outbound operations. Running jobs can finish into review storage but cannot proceed to handoff without a new approval.

## Delivery Sequence

### Release A: Functional Studio Core

- Auth-ready internal Studio route and tenant/brand/campaign data contracts.
- Campaign brief editor, deterministic storyboarding, revisioning, approvals, audit feed, and fixture provider.
- Local file/object-storage abstraction, export manifest, and tests.

### Release B: Production Worker

- Queue protocol, worker service, provider adapter interface, budget and retry control.
- FFmpeg assembly, captions, brand overlay, platform export profiles, technical QA, and end-to-end fixture render.

### Release C: Cloud And Local Rendering

- One configured cloud provider adapter, a local ComfyUI/Wan adapter, provider health, polling, cancellation, and cost capture.
- Environment documentation and deployment procedure for Sami's VPS.

### Release D: Avatar, Marketing, And Learning

- Consent-controlled avatar/UGC render mode.
- Social draft handoff, campaign UTM generation, outcome ingestion, and creative-performance reporting.

## Testing

The implementation includes unit tests for schemas, state transitions, tenant boundaries, budget calculation, retry behavior, and export manifests. Integration tests use the fixture provider and a fake renderer so they require no external keys. A smoke workflow creates a campaign, approves a storyboard, queues scenes, receives fixture clips, renders deterministic exports, records QA, and blocks handoff until edit approval.

Production provider tests run only when explicitly enabled by environment variables and must never use production tenant assets by default.

## Operational Requirements

Required configuration is documented but not committed: database URL, encryption key, object storage endpoint and credentials, worker authentication secret, configured video provider credentials, allowed provider list, per-campaign budget ceiling, FFmpeg path, and optional ComfyUI endpoint.

The worker exposes health and queue metrics. Failed jobs preserve their raw error category, sanitized diagnostic detail, provider request ID, and next permitted action. It never discards a rendered asset or silently reruns a billable job.
