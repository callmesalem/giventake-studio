# Task 4 Report: Tenant Branding, Audit Events, And Support Sessions

## What Was Implemented

- Added the exact 23-value Release 1 audit action union and a strict audit metadata schema. Only allowlisted scalar identifiers, codes, statuses, dates, counts, provider values, and booleans are accepted; unsupported keys, nested values, PII-shaped keys, secrets, tokens, and free-text notes are rejected.
- Tightened the database audit sanitizer to the same fixed key categories so direct database callers cannot use supported keys as a free-text or nested-value escape hatch.
- Added `writeAuditEvent(input)` as a fail-closed, server-only wrapper around `write_audit_event`.
- Added HTTPS logo validation, lowercase six-digit hex normalization, a pure WCAG contrast helper, and 4.5:1 primary/on-primary validation.
- Added owner-only brand reads and updates. `updateBrand` derives the tenant from `requireClientOwnerContext`; the authenticated `update_tenant_brand` RPC upserts the brand and writes `brand.updated` in one transaction.
- Removed direct authenticated insert/update/delete privileges on `brands`, preventing owners from bypassing the audited RPC. Existing tenant RLS and service-role seed/job access remain intact.
- Added authenticated brand CSS variables only on the `_app` layout element. No root/document/body/public-site global style is mutated.
- Added the quiet `/settings` UI with native color inputs/swatches, HTTPS logo URL, display/report names, contrast-aware save button, and owner-authorized save boundary.
- Added explicit support start/end server functions and `/admin/support`. Start requires an authenticated allowlisted platform admin, an active tenant, a sanitized 10-500 character reason, and an integer duration from 1-60 minutes.
- Support start uses the transactional `start_support_session` RPC, verifies the persisted row and exact expiry, and sets `gt_active_tenant` plus `gt_support_session` as Secure, HTTP-only, SameSite=Strict cookies.
- Bound support tenant resolution to the exact support-session cookie and matching `support.started` audit proof. Ordinary tenant selection writes only `gt_active_tenant` and cannot activate support access.
- Added service-only `end_support_session`, which revokes the exact active admin-owned session and writes `support.ended` in one transaction. The application clears both support and active-tenant cookies, including on failure. Sign-out also clears both cookies.
- Regenerated the route tree and Supabase database types. The generated audit RPC argument nullability was corrected locally to match the actual nullable SQL signature.

## TDD RED Evidence

- Initial TypeScript RED:
  - Command: `npx --yes bun x vitest run src/features/audit src/features/branding src/features/tenants/support.server.test.ts src/features/tenants/tenant-context.server.test.ts`
  - Exit: `1`.
  - Result: four suites failed to resolve the missing Task 4 modules/routes. The new tenant regression also failed because a mismatched support-session cookie still resolved an audited support row.
- Initial database RED:
  - Command: `npx --yes bun x supabase test db supabase/tests/release1_task4.test.sql`
  - Exit: `1`.
  - Result: unsupported audit metadata was accepted, `update_tenant_brand` and `end_support_session` did not exist, and exact-session revocation/audit assertions failed. A test-plan count typo was corrected from 16 to 17 before implementation.
- UI regression RED:
  - Command: `npx --yes bun x vitest run src/features/branding/brand.routes.test.tsx src/features/auth/auth.routes.test.tsx`
  - Exit: `1`.
  - Result: two layout tests caught TanStack `Link` use outside router context. The two simple shell links were changed to native anchors.
- Audit-null RED:
  - Command: `npx --yes bun x vitest run src/features/audit/audit.server.test.ts`
  - Exit: `1`; 1 of 9 tests failed because an allowlisted explicit null was rejected despite the public scalar metadata contract.
- Database hardening RED:
  - Command: `npx --yes bun x supabase test db supabase/tests/release1_task4.test.sql`
  - Exit: `1`; 4 of 19 assertions failed because free text under `reason_code` and low-contrast direct RPC branding were accepted, producing an extra audit and changing the brand.

## GREEN And Verification Evidence

- Focused Task 4 tests:
  - Command: `npx --yes bun x vitest run src/features/audit src/features/branding src/features/tenants`
  - Exit: `0`; 5 files and 35 tests passed.
- Full Growth OS tests:
  - Command: `npx --yes bun run test`
  - Exit: `0`; 9 files and 53 tests passed.
- Clean database rebuild:
  - Command: `npx --yes bun x supabase db reset`
  - Exit: `0`; all five migrations applied from a recreated local database.
- Full database tests:
  - Command: `npx --yes bun run test:db`
  - Exit: `0`; 4 files and 74 pgTAP assertions passed.
- Database lint:
  - Command: `npx --yes bun x supabase db lint --local --level warning`
  - Exit: `0`; empty result set and `No schema errors found`.
- Typecheck:
  - Command: `npx --yes bun run typecheck`
  - Exit: `0`; `tsc --noEmit` reported no errors.
- Lint:
  - Command: `npx --yes bun run lint`
  - Exit: `0`; ESLint reported no errors or warnings.
- Production build and route generation:
  - Command: `npx --yes bun run build`
  - Exit: `0`; client transformed 1900 modules and SSR transformed 87 modules.
  - Generated routes include `fullPath: '/settings'` under `_app` and `fullPath: '/admin/support'`.
- Authorization evidence:
  - Brand boundary tests prove the active tenant comes only from `requireClientOwnerContext`, support/read-only context cannot mutate, and the database rejects another tenant plus direct table mutation.
  - Support tests prove non-admin rejection, required sanitized reason, 60-minute maximum, exact tenant/session/expiry, secure cookies, exact-session end, audit proof, and unchanged concurrent support sessions.
  - Ordinary tenant-selection source scan found 0 references to `gt_support_session` or `SUPPORT_SESSION_COOKIE`.
- Credential leak scans:
  - `growth-os/dist/client`: 0 matches for `SUPABASE_SERVICE_ROLE_KEY`, `createJobSupabase`, `FIELD_ENCRYPTION_KEY`, `LOOKUP_HMAC_KEY`, `OAUTH_STATE_SECRET`, or `service_role`.
  - Routes and client-safe server-function modules: 0 matches for service-role clients, keys, or role names.
- Scope and whitespace:
  - `git diff --check`: exit `0`.
  - Root-app change scan: 0 files. No root formatting cleanup was included.

## Files Changed

- `.superpowers/sdd/2026-08-09-giventake-growth-os-release-1/task-4-report.md`
- `growth-os/src/features/audit/audit.server.ts`
- `growth-os/src/features/audit/audit.server.test.ts`
- `growth-os/src/features/auth/auth.functions.ts`
- `growth-os/src/features/branding/brand.functions.ts`
- `growth-os/src/features/branding/brand.routes.test.tsx`
- `growth-os/src/features/branding/brand.schemas.ts`
- `growth-os/src/features/branding/brand.server.ts`
- `growth-os/src/features/branding/brand.server.test.ts`
- `growth-os/src/features/tenants/support.functions.ts`
- `growth-os/src/features/tenants/support.schemas.ts`
- `growth-os/src/features/tenants/support.server.ts`
- `growth-os/src/features/tenants/support.server.test.ts`
- `growth-os/src/features/tenants/tenant-context.server.ts`
- `growth-os/src/features/tenants/tenant-context.server.test.ts`
- `growth-os/src/lib/database.types.ts`
- `growth-os/src/routes/_app.tsx`
- `growth-os/src/routes/_app.settings.tsx`
- `growth-os/src/routes/admin.support.tsx`
- `growth-os/src/routeTree.gen.ts`
- `growth-os/supabase/migrations/202608090005_task4_branding_support.sql`
- `growth-os/supabase/tests/release1_rls.test.sql`
- `growth-os/supabase/tests/release1_task4.test.sql`

## Self-Review

- Audit action values exactly match the approved plan. Metadata validation is strict in both TypeScript and PostgreSQL, accepts explicit scalar nulls, and has no arbitrary-key or nested-value path.
- Branding cannot identify a tenant from client input. Reads use `requireTenantContext`; mutations use `requireClientOwnerContext` and a user-scoped Supabase client. No route or client-safe module imports the service-role client.
- Brand table mutations and `brand.updated` share one transaction. A pgTAP failure case proves an audit failure rolls the brand update back.
- Support start and end auditing occurs inside their database transactions. There is no best-effort success path after a support or brand mutation.
- Platform-admin membership alone grants no tenant data. Support reads require the chosen tenant, exact cookie-bound session id, active/unrevoked row, matching administrator, and persisted `support.started` proof.
- The support reason is stored only in `support_sessions`; it is not copied into audit metadata or cookies.
- The authenticated layout owns all three brand CSS variables. Tests verify document and body globals stay empty.
- Direct authenticated brand table writes are now denied, closing the only bypass around contrast validation and transactional audit.
- Task 3 fail-closed denial auditing, invitation transactions/recovery, RLS semantics, secure Supabase session cookies, and server-only service credentials remain covered by the full prior suites.

## Concerns

- Vite continues to print the existing non-blocking `vite-tsconfig-paths` advisory during tests and builds. This task did not modify build-tool configuration.
- No live external Supabase authentication or email flow was exercised. Route authorization, cookies, RLS, and transactional behavior were verified through focused boundary tests, generated production routes, a real local Supabase database, and pgTAP.
