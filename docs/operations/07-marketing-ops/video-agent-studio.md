# Video Agent Studio

## Release boundary

Video Agent Studio is a private GivenTake Devs application at `/studio`. It uses Supabase email magic links, tenant memberships, row-level security, durable campaign records, immutable approval/audit records, and signed jobs for the VPS worker.

This release permits one controlled `fixture` job only. Fixture mode produces no paid generation, no provider API call, no social publishing, no ad spend, and no client-facing media library. Do not enable a paid provider, storage upload, automatic publishing, or advertising spend as part of this release.

The public website remains public. The Studio is available only to a signed-in user with a `video_studio.memberships` record.

## Required server configuration

Set these values in the server-side environment manager for each local, staging, or production application. Never add a `VITE_` prefix to any Studio value and never commit a real value to Git.

| Variable | Safe initial value | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase project URL | Server-side Supabase endpoint |
| `SUPABASE_ANON_KEY` | project anon key | Cookie-bound authenticated user client |
| `SUPABASE_SERVICE_ROLE_KEY` | project service role key | Administrative bootstrap and future worker integration only |
| `STUDIO_APP_URL` | `https://<studio-host>` | Magic-link callback origin |
| `STUDIO_WORKER_URL` | private TLS worker URL | Signed render control plane |
| `STUDIO_WORKER_SHARED_SECRET` | 64-character hex secret | Shared HMAC secret; must match the VPS worker |
| `STUDIO_OUTBOUND_KILL_SWITCH` | `true` | Blocks every worker submission by default |
| `STUDIO_ALLOWED_RENDER_PROVIDERS` | `fixture` | Explicit control-plane allowlist |
| `STUDIO_PROVIDER_RATES_JSON` | `{"fixture":{"fixture":0}}` | Cost policy in cents per second |

Keep `STUDIO_OUTBOUND_KILL_SWITCH=true` except during the short, observed fixture procedure below. The worker's own `STUDIO_OUTBOUND_KILL_SWITCH` must also start as `true`.

## Initial Supabase bootstrap

1. Create separate Supabase projects for staging and production. Enable daily backups and restrict administrative access.
2. In each project, add `https://<studio-host>/studio/auth/callback` to Supabase Auth redirect URLs. Keep a local callback URL only in the local project.
3. From a protected operator machine, link the target project and apply the migration:

   ```powershell
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

4. Run the tenant-policy test against a local reset before the first deployment:

   ```powershell
   npx supabase db reset
   npm run test:studio-db
   ```

5. Create the first operator in Supabase Auth using an admin-created magic link or invitation. Copy that user's UUID from the Auth users screen.
6. In the protected SQL editor, create exactly one tenant, its brand, and its initial operator membership. Substitute the user UUID; do not place it in application code.

   ```sql
   with tenant as (
     insert into video_studio.tenants (slug, display_name)
     values ('giventake-devs', 'GivenTake Devs')
     returning id
   ), brand as (
     insert into video_studio.brands (tenant_id, name, website, call_to_action, primary_color, accent_color)
     select id, 'GivenTake Devs', 'https://giventakedevs.com', 'Book a discovery call', '#112548', '#CFAE64'
     from tenant
     returning tenant_id
   )
   insert into video_studio.memberships (tenant_id, user_id, role)
   select tenant_id, '<operator-user-uuid>', 'operator'
   from brand;
   ```

7. Deploy the application with `STUDIO_OUTBOUND_KILL_SWITCH=true`. A user without a membership must not see campaign data or render controls. A user with one membership is selected automatically.

## Local development

Without Supabase configuration, development uses only the deterministic in-memory fixture repository. It is never selected in production.

```powershell
npm run dev -- --port 8086
```

Open `http://localhost:8086/studio` for the local operator fixture. Open `http://localhost:8086/studio/sign-in` to inspect the real sign-in screen. Local data resets when the server restarts.

## Controlled fixture activation

Run this only after the private application, migration, and VPS worker are deployed. Assign one operator to observe the run and write down its campaign ID, render job ID, and outcome.

1. Verify both application and worker environments use the same `STUDIO_WORKER_SHARED_SECRET`, only the `fixture` provider, and `STUDIO_OUTBOUND_KILL_SWITCH=true`.
2. Confirm worker health through its localhost/private network path:

   ```powershell
   curl http://127.0.0.1:8788/healthz
   ```

3. Sign in as the provisioned operator, create a test campaign with a positive ceiling, plan the storyboard, and approve it. Do not put customer information into the fixture brief.
4. Change the application and worker `STUDIO_OUTBOUND_KILL_SWITCH` values to `false` for this one observed run, then restart or redeploy the affected services.
5. In `/studio`, choose `Queue fixture render` once. The control plane persists the idempotency key and the signed job before calling the worker. Do not click it a second time.
6. Confirm the worker reaches `completed`, records a `qa_passed` attempt, and has three export manifests: `vertical` (9:16), `square` (1:1), and `landscape` (16:9). The worker's protected job status endpoint requires an HMAC signature; inspect it through the application or worker operator tooling, not from a public browser.
7. Confirm the Studio campaign, storyboard approval, render-request audit event, and operator identity in Supabase. This release does not yet copy worker export metadata back into Studio Postgres.
8. Immediately restore both application and worker settings to `STUDIO_OUTBOUND_KILL_SWITCH=true`, restart or redeploy them, and record the date, operator, render job ID, and result in the acceptance log.

## Failure recovery and secret rotation

- Stop on a missing membership, tenant mismatch, stale storyboard approval, configured-provider failure, or worker rejection. Do not bypass RLS or manually mark a campaign completed.
- Leave both kill switches true while investigating. Record only sanitized reason codes and IDs; never place API keys, cookies, HMAC signatures, signed URLs, or raw provider payloads in tickets or logs.
- A failed worker submission becomes `WORKER_UNAVAILABLE`. Fix the network/configuration condition, create a new campaign revision if needed, and use the existing render idempotency key only for an intentional retry of the same request.
- Rotate `STUDIO_WORKER_SHARED_SECRET` after any suspected exposure: set a new 64-character hex value in the VPS worker and application environment, restart both, then repeat the controlled fixture activation. Rotate a potentially exposed Supabase service-role key in the Supabase dashboard and update only server-side deployment secrets.
- Back up the Supabase project according to its recovery policy and the VPS worker volume according to [the worker guide](video-agent-production-worker.md). Test restores in staging before relying on them.

## Next release gates

Do not add a real provider until this runbook has one accepted fixture result and the new release supplies private object storage, provider-specific polling/cancellation, cost reconciliation, health monitoring, asset ingestion, and a signed worker callback. Social publishing, avatar/UGC generation, and advertising spend require their own approval and audit releases.
