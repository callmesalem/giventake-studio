# Video Agent Studio

## Current capability

The local Studio route at `/studio` creates a GivenTake campaign, produces a deterministic three-scene storyboard, requires an operator approval, performs a no-cost fixture render, records QA, creates 9:16, 1:1, and 16:9 export manifests, requires edit approval, then marks the package ready for marketing drafts.

The fixture provider creates no real media and makes no external request. It exists to verify the production workflow and approval boundaries before a paid provider is connected.

## Local run

1. Run `npm run dev -- --port 5174` from the Studio worktree.
2. Open `http://localhost:5174/studio`.
3. Create a campaign with a positive generation ceiling.
4. Select `Plan storyboard`, then `Approve storyboard`.
5. Select `Render fixture`, then `Approve edit`.
6. Select `Send to marketing drafts`.

The development repository resets when the server restarts. It is not a production data store.

## Non-negotiable controls

- A campaign cannot render without a storyboard approval.
- A campaign cannot reach marketing handoff without an edit approval.
- Generated footage is raw footage. Logo, URL, CTA, captions, and legal copy must be overlaid deterministically during post-production.
- No provider API key belongs in a browser variable or this repository.
- Do not deploy the existing Studio route publicly. It is local-only until real authentication and tenant membership are installed.
- Keep `STUDIO_OUTBOUND_KILL_SWITCH=true` until the VPS worker's monitoring and explicit external-action approvals are in place.

## Production activation sequence

1. Add authenticated tenant membership and server-side session identity.
2. Replace the in-memory repository with Postgres using tenant row-level policies.
3. Deploy a separate worker on Sami's VPS with object storage, FFmpeg, and the worker shared secret.
4. Install one video-provider adapter behind the `VideoProvider` contract and set a small per-campaign budget ceiling.
5. Run a test campaign using test assets and verify every provider attempt, cost, output, and audit record.
6. Connect marketing handoff as drafts only. Publishing and advertising spend remain separate human approvals.

## Variables for later releases

`STUDIO_TENANT_ID` and `STUDIO_ACTOR_ID` are local development identity values. `STUDIO_WORKER_SHARED_SECRET`, `STUDIO_STORAGE_*`, `STUDIO_VIDEO_PROVIDER_API_KEY`, and `STUDIO_COMFYUI_ENDPOINT` remain unused until the worker release. Empty values are correct until that release begins.
