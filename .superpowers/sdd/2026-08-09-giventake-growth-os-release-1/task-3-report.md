# Task 3 Report: Implement Server-Side Authentication And Active-Tenant Resolution

## What You Implemented

- Added cookie-aware user and service-role Supabase factories. Both read environment variables only when called, and the service-role factory remains behind server-only modules.
- Added strict Zod schemas for magic-link, callback, invitation, and tenant-selection inputs.
- Added non-enumerating magic-link requests, exact public `AuthUser` shaping, authenticated-user requirements, sign-out, callback exchange, and platform-admin-only client-owner invitations.
- Stored pending invitation tenant context only in server-controlled app metadata. Callback acceptance validates the pending invitation, upserts the `client_owner` membership, marks the invitation accepted, and removes only the pending fields while preserving unrelated app metadata.
- Added pure and adapter-driven tenant resolution for owner memberships and active, audited, tenant-specific support sessions.
- Added sanitized `cross_tenant_access_denied` recording before a supplied disallowed tenant id is rejected. Metadata contains only `{ "reason_code": "tenant_not_allowed" }`.
- Added `requireTenantContext` for reads and `requireClientOwnerContext` for mutations. The latter rejects the `platform_admin` support variant with `SUPPORT_READ_ONLY`.
- Added server functions for magic links, callback completion, invitations, sign-out, available tenants, tenant selection, and route-session checks.
- Added functional `/login`, `/auth/callback`, `/select-tenant`, and authenticated pathless layout routes with compact operational UI.
- Moved the scaffold placeholder from the public `index.tsx` route to `_app.index.tsx`. This removes the `/` route conflict and makes the existing root placeholder a child of the authenticated layout.
- Updated the Growth OS environment template to use `APP_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` as server-side variables.

## TDD RED Evidence

- Initial focused RED:
  - Command: `npx --yes bun x vitest run src/features/auth src/features/tenants`
  - Exit: `1`
  - Result: `2` failed suites, `0` tests collected.
  - Expected failures: Vite could not resolve `./auth.server` or `./tenant-context.server` because the production modules did not exist.
- Initial route RED:
  - Command: `npx --yes bun x vitest run src/routes/auth-routes.test.tsx`
  - Exit: `1`
  - Result: `1` failed suite, `0` tests collected.
  - Expected failure: Vite could not resolve the missing tenant-selection route.
- Route accessibility regression:
  - Command: `npx --yes bun x vitest run src/routes/auth-routes.test.tsx`
  - Exit: `1`
  - Result: `1` of `3` tests failed because the tenant button's accessible name included visible role text in addition to the intended command label.
  - Fix: assigned the exact `Continue with <tenant>` accessible label at the real button boundary.
- App-metadata preservation RED:
  - Command: `npx --yes bun x vitest run src/features/auth/auth.server.test.ts`
  - Exit: `1`
  - Result: `2` of `7` tests failed because setting and clearing pending invitation fields discarded unrelated server-owned app metadata.
  - Fix: merge pending fields into existing app metadata and remove only the two pending keys after acceptance.

## GREEN And Verification Evidence

- Focused auth and tenant GREEN:
  - Command: `npx --yes bun x vitest run src/features/auth src/features/tenants`
  - Exit: `0`
  - Result: `3` files passed, `17` tests passed.
- Full Growth OS suite:
  - Command: `npx --yes bun run test`
  - Exit: `0`
  - Result: `4` files passed, `18` tests passed.
- Growth OS typecheck:
  - Command: `npx --yes bun run typecheck`
  - Exit: `0`; `tsc --noEmit` reported no errors.
- Growth OS lint:
  - Command: `npx --yes bun run lint`
  - Exit: `0`; ESLint reported no errors or warnings.
- Growth OS production build:
  - Command: `npx --yes bun run build`
  - Exit: `0`.
  - Result: client build transformed `195` modules and SSR build transformed `74` modules.
- Diff validation:
  - Command: `git diff --check`
  - Exit: `0`; no whitespace errors.
- Client asset leak scan:
  - Scan terms: `SUPABASE_SERVICE_ROLE_KEY`, `createJobSupabase`, `FIELD_ENCRYPTION_KEY`, `LOOKUP_HMAC_KEY`, and `OAUTH_STATE_SECRET` under `growth-os/dist/client`.
  - Result: `0` matches.
- Client-safe source scan:
  - Scan scope: all Growth OS route files plus `auth.functions.ts` and `tenant-context.functions.ts`.
  - Terms: `createJobSupabase` and `SUPABASE_SERVICE_ROLE_KEY`.
  - Result: `0` matches.
- Audit metadata review:
  - Cross-tenant denials use only `{ reason_code: "tenant_not_allowed" }`.
  - Invitation audits use only `{ channel: "magic_link" }`.
  - Both shapes satisfy the existing scalar-only audit sanitizer and include no email, token, supplied tenant id, credential, or payload in metadata.
- Root build was not run because no root application source, dependency, configuration, or generated route file changed. The only environment and application changes are under `growth-os/`.
- The environment has no directly installed `bun` command, so the required Bun commands were executed through the cached `npx --yes bun` wrapper (`bun 1.3.14`).

## Files Changed

- `.superpowers/sdd/2026-08-09-giventake-growth-os-release-1/task-3-report.md`
- `growth-os/.env.example`
- `growth-os/src/features/auth/auth.functions.ts`
- `growth-os/src/features/auth/auth.routes.test.tsx`
- `growth-os/src/features/auth/auth.schemas.ts`
- `growth-os/src/features/auth/auth.server.test.ts`
- `growth-os/src/features/auth/auth.server.ts`
- `growth-os/src/features/tenants/tenant-context.functions.ts`
- `growth-os/src/features/tenants/tenant-context.server.test.ts`
- `growth-os/src/features/tenants/tenant-context.server.ts`
- `growth-os/src/lib/server/supabase.server.ts`
- `growth-os/src/routeTree.gen.ts`
- `growth-os/src/routes/_app.index.tsx`
- `growth-os/src/routes/_app.tsx`
- `growth-os/src/routes/auth.callback.ts`
- `growth-os/src/routes/index.tsx` (removed and replaced by `_app.index.tsx`)
- `growth-os/src/routes/login.tsx`
- `growth-os/src/routes/select-tenant.tsx`

## Self-Review

- Standard PostgreSQL RLS behavior remains unchanged. This task adds application-boundary authorization and auditing without changing cross-tenant update semantics from zero affected records.
- Every service-role use is confined to `*.server.ts` files guarded by `@tanstack/react-start/server-only`; client-safe server-function modules load them only inside handlers.
- User memberships are queried through the cookie-bound user Supabase client. Service access is used only for admin invitation operations, protected support-session/audit checks, and security-event recording.
- Support context requires the selected tenant, an unrevoked/unexpired support session, and a matching `support.started` audit event. Owner membership takes precedence if a user has both forms of access.
- Tenant selection validates a UUID, resolves it through the same boundary as all later reads, records denial before throwing, and writes `gt_active_tenant` only after authorization.
- Sign-out clears `gt_active_tenant` in a `finally` block even if Supabase sign-out fails.
- Magic-link success and provider/account errors share the same `{ accepted: true }` application response and UI copy.
- Invitation tenant and invitation ids are read only from app metadata; editable user metadata is never consulted.
- The final generated route tree puts `/` beneath `_app`, while login, callback, and tenant selection remain public route surfaces with their own authorization behavior.

## Issues Or Concerns

- `@supabase/ssr` resolves to `0.5.2` while the workspace currently resolves `@supabase/supabase-js` to `2.112.2`. Their generic parameter positions differ, so `createUserSupabase` contains one localized compatibility cast back to `SupabaseClient<Database>`. Runtime APIs, typecheck, tests, and both production bundles pass.
- Vite continues to emit the existing non-blocking `vite-tsconfig-paths` advisory during tests and builds. This task did not change build-tool configuration.
- No live Supabase email delivery was attempted; external auth calls are covered through focused boundary adapters, while the real TanStack client and SSR bundles are validated by production build.

## Fix Round 1

### Scope And Resolution

- Cross-tenant denial recording now fails closed with the stable sanitized `SECURITY_AUDIT_FAILED` code whenever no audit anchor exists or tenant lookup/audit persistence fails. The console-only fallback was removed.
- Invitation preparation is now a service-role-only transactional RPC. It supersedes expired pending invitations, reuses a current usable invitation on retry, repairs a missing invitation audit, and commits durable invitation state plus sanitized audit data before email is sent.
- Invitation acceptance is now a service-role-only transactional and idempotent RPC. Membership grant, invitation acceptance, accepted-user binding, and the sanitized membership audit commit together. A callback can retry after app-metadata cleanup failure without duplicating membership or audit state.
- Callback recovery can locate a durable active invitation by the authenticated email when post-email app-metadata persistence failed. Successful retries remove only the two pending invitation keys and preserve unrelated server-controlled app metadata.
- Supabase session cookies now explicitly set `secure: process.env.NODE_ENV === "production"` while retaining `httpOnly: true` and `sameSite: "lax"`.

### RED Evidence

- Focused TypeScript RED:
  - Command: `npx --yes bun x vitest run src/features/auth src/features/tenants src/lib/server/supabase.server.test.ts`
  - Exit: `1`.
  - Result: `7` failed and `17` passed. Failures demonstrated email-before-state ordering, missing callback recovery, swallowed audit failures/no audit anchor behavior, and missing explicit production `Secure` cookies.
- Initial database RED:
  - Command: `npx --yes bun x supabase test db`
  - Exit: `1`.
  - Result: all `15` new auth transition assertions failed because `prepare_membership_invitation` did not exist; the existing retention and RLS files passed.
- Retry audit-repair RED after the first RPC implementation:
  - Command: `npx --yes bun x supabase test db`
  - Exit: `1`.
  - Result: `1` of `17` auth assertions failed: `retry repairs a missing invitation audit before email` had `0` events instead of `1`. The RPC was then changed so reused and newly inserted invitations share the same mandatory audit check before success.

### GREEN And Verification Evidence

- Focused auth, tenant, and cookie tests:
  - Command: `npx --yes bun x vitest run src/features/auth src/features/tenants src/lib/server/supabase.server.test.ts`
  - Exit: `0`; `4` files and `25` tests passed.
- Database reset and pgTAP:
  - Commands: `npx --yes bun x supabase db reset` and `npx --yes bun x supabase test db`
  - Exit: `0`; all `3` files and `55` assertions passed.
- Full Growth OS suite:
  - Command: `npx --yes bun run test`
  - Exit: `0`; `5` files and `26` tests passed.
- Growth OS typecheck:
  - Command: `npx --yes bun run typecheck`
  - Exit: `0`; `tsc --noEmit` reported no errors.
- Growth OS lint:
  - Command: `npx --yes bun run lint`
  - Exit: `0`; ESLint reported no errors or warnings.
- Growth OS production build:
  - Command: `npx --yes bun run build`
  - Exit: `0`; client build transformed `195` modules and SSR build transformed `74` modules.
- Client leak scans:
  - `dist/client` had zero matches for `SUPABASE_SERVICE_ROLE_KEY`, `createJobSupabase`, `FIELD_ENCRYPTION_KEY`, `LOOKUP_HMAC_KEY`, or `OAUTH_STATE_SECRET`.
  - Client-safe source had zero matches for `SUPABASE_SERVICE_ROLE_KEY` or `createJobSupabase`.
- Audit metadata inspection found only `{ reason_code: "tenant_not_allowed" }`, `{ channel: "magic_link" }`, and `{ change_code: "invitation_accepted" }`. No email, token, credential, supplied tenant id, or payload is stored in audit metadata.
- `git diff --check` exited `0` with no whitespace errors.
- The root build was not run because this round changes only Growth OS source, tests, generated database types, and its Supabase migration; no root application file is affected.

### Files Changed

- `.superpowers/sdd/2026-08-09-giventake-growth-os-release-1/task-3-report.md`
- `growth-os/src/features/auth/auth.server.test.ts`
- `growth-os/src/features/auth/auth.server.ts`
- `growth-os/src/features/tenants/tenant-context.server.test.ts`
- `growth-os/src/features/tenants/tenant-context.server.ts`
- `growth-os/src/lib/database.types.ts`
- `growth-os/src/lib/server/supabase.server.test.ts`
- `growth-os/src/lib/server/supabase.server.ts`
- `growth-os/supabase/migrations/202608090004_task3_auth_transitions.sql`
- `growth-os/supabase/tests/release1_auth.test.sql`

### Self-Review And Concerns

- Existing RLS policies and standard zero-row cross-tenant update behavior are unchanged. The new invitation RPCs are denied to `authenticated` and executable only by `service_role`.
- Invitation tenant context remains exclusively in server-controlled app metadata and durable server-side invitation state. Editable user metadata is never read for authorization.
- A failed email delivery leaves a durable audited invitation that a retry can reuse. A failed app-metadata update after delivery remains recoverable because callback lookup uses the authenticated email and the transactional acceptance RPC verifies that email against `auth.users`.
- Cross-tenant audit metadata remains sanitized. When neither the supplied tenant nor any authorized tenant can anchor the event, authorization returns an explicit auditable-failure code rather than claiming the denial was recorded.
- External Supabase email delivery was not exercised live; ordering and recovery are verified through focused dependency tests, while the database state transitions are covered by pgTAP.
