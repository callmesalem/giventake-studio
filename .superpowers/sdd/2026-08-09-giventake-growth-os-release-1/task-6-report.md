# Task 6 Report: Encrypted Lead And Confirmed-Revenue Ledger

Date: 2026-08-12
Branch: `codex/growth-os-release-1`
Base commit: `3c3cb64`

## Result

Implemented the tenant-scoped operational lead and confirmed-revenue ledger across Growth OS server boundaries, transactional Postgres functions, generated contracts/routes, and the authenticated lead workflow.

The delivered behavior:

- Lists at most 100 active tenant leads with status, source, received date, deterministic attribution confidence, activity, and confirmed revenue.
- Filters by status, source, created date, exact normalized email HMAC, and exact normalized phone HMAC without bulk decryption.
- Decrypts only returned page/detail records and returns no ciphertext, lookup hash, raw consent metadata, unrelated audit metadata, or revenue-note ciphertext.
- Makes wrong-tenant and unknown lead UUIDs indistinguishable as `LEAD_NOT_FOUND` at the server boundary.
- Preserves the exact forward transition matrix and keeps terminal reopen as a separate 10-500 character audited action that returns the lead to `qualified`.
- Allows `won` without inventing revenue and permits confirmed revenue only for `won` leads.
- Validates positive PostgreSQL bigint decimal digits, at most two major-unit decimals, the finite ISO 4217 allowlist, and non-future confirmation dates.
- Encrypts optional revenue notes with the lead purpose and excludes them from audit, client responses, logs, analytics, and connector surfaces.
- Runs status, reopen, revenue/outcome, last-activity, and audit writes atomically in SQL RPCs.
- Blocks direct owner status/revenue writes while preserving existing RLS behavior and service/retention operation.
- Preserves exact-session, audited support reads while every mutation begins at the client-owner boundary.
- Adds the dense lead table, exact lookup/filter controls, segmented status workflow, revenue and reopen forms, attribution evidence, typed consent receipt, and lead-only activity chronology.

## TDD Evidence

### RED 1: Missing State, Server, And UI Modules

Command from `growth-os/`:

```powershell
& '.\node_modules\.bin\vitest.exe' run src/features/leads
```

Result: failed as expected. All three suites failed import resolution for the absent `lead-state`, `leads.server`, `lead-list`, and `lead-detail` modules; no tests ran.

### RED 2: Missing Transactional RPCs

Command from `growth-os/`:

```powershell
& '.\node_modules\.bin\supabase.exe' test db supabase/tests/release1_task6_lead_ledger.test.sql
```

Result: failed as expected. The first three pgTAP assertions could not find `change_lead_status`, `reopen_lead`, or `record_lead_revenue`; PostgreSQL then rejected the absent status RPC.

### RED 3: Current Currency, Confidence, And Cursor Regressions

Command from `growth-os/`:

```powershell
& '.\node_modules\.bin\vitest.exe' run src/features/leads
```

Result: 3 of 51 assertions failed as expected: `XCG` was absent, list confidence depended on relation row order, and the next-page URL dropped active filters.

Direct database command before reset:

```powershell
& '.\node_modules\.bin\supabase.exe' test db supabase/tests/release1_task6_lead_ledger.test.sql
```

Result: 1 of 30 assertions failed as expected because the running pre-reset SQL allowlist did not accept `XCG`.

### Verification Regressions Found And Resolved

The first full pgTAP run exposed that an early Task 6 sanitizer replacement had removed Task 4 finite metadata checks and that table-level UPDATE revocation prevented an established cross-tenant RLS assertion from executing. The migration was corrected to preserve the full finite sanitizer with only the `reason` key added, and direct-write enforcement moved to narrow owner-aware triggers around the transactional RPCs.

The first fresh full application run exposed a pre-existing probabilistic crypto test: changing the last base64url character could alter only unused padding bits. The test now flips an actual decoded ciphertext/tag byte. Ten consecutive focused runs passed before the full suite was rerun.

## GREEN Evidence

Focused lead command:

```powershell
& '.\node_modules\.bin\vitest.exe' run src/features/leads
```

Result: 3 files passed, 51 tests passed.

Clean database and full pgTAP commands:

```powershell
& '.\node_modules\.bin\supabase.exe' db reset
npx --yes bun run test:db
```

Result: all 10 migrations applied from an empty local database; 8 pgTAP files passed, 221 assertions passed. The Task 6 file passed all 30 assertions.

Full Growth OS commands:

```powershell
npx --yes bun run test
npx --yes bun run typecheck
npx --yes bun run lint
npx --yes bun run build
```

Result: 15 files and 149 tests passed; typecheck and lint passed with no findings; the production client and SSR builds passed and generated `/leads` and `/leads/$leadId`.

Deterministic crypto regression command:

```powershell
1..10 | ForEach-Object {
  & '.\node_modules\.bin\vitest.exe' run src/lib/server/crypto.server.test.ts --reporter=dot
}
```

Result: all 10 consecutive runs passed.

```powershell
git diff --check
```

Result: passed with no whitespace errors.

## Security And Client Scans

The final `growth-os/dist/client` and lead client-source scans covered:

- `FIELD_ENCRYPTION_KEY_V1`, `LOOKUP_HMAC_KEY_V1`, `SUPABASE_SERVICE_ROLE_KEY`, service-role/private-key markers.
- All `*_ciphertext`, email/phone lookup hash, credential envelope, and signing-secret storage identifiers.
- Revenue-note ciphertext/storage identifiers and test note values.
- Lead-bundle support role/session/capability markers.
- Test lead names, emails, notes, and other fixture personal values.

Result: no matches in every scan.

Static review confirmed both lead-table reads include explicit `tenant_id` and `restricted_at is null`; detail subqueries include `tenant_id`; exact lookup search supplies only HMAC columns; and no lead module logs data.

The local dev server starts at `http://127.0.0.1:4174/login`; the login route returned HTTP 200 and rendered Growth OS. Supabase was stopped after database verification.

## Changed Files

- `.superpowers/sdd/2026-08-09-giventake-growth-os-release-1/task-6-report.md`
- `growth-os/src/features/audit/audit.server.ts`
- `growth-os/src/features/leads/lead-detail.tsx`
- `growth-os/src/features/leads/lead-list.tsx`
- `growth-os/src/features/leads/lead-state.test.ts`
- `growth-os/src/features/leads/lead-state.ts`
- `growth-os/src/features/leads/lead-ui.test.tsx`
- `growth-os/src/features/leads/lead.schemas.ts`
- `growth-os/src/features/leads/leads.functions.ts`
- `growth-os/src/features/leads/leads.server.test.ts`
- `growth-os/src/features/leads/leads.server.ts`
- `growth-os/src/lib/database.types.ts`
- `growth-os/src/lib/server/crypto.server.test.ts`
- `growth-os/src/routeTree.gen.ts`
- `growth-os/src/routes/_app.leads.$leadId.tsx`
- `growth-os/src/routes/_app.leads.tsx`
- `growth-os/src/routes/_app.tsx`
- `growth-os/supabase/migrations/202608120010_task6_lead_ledger.sql`
- `growth-os/supabase/tests/release1_rls.test.sql`
- `growth-os/supabase/tests/release1_task6_lead_ledger.test.sql`

No root application file changed.

## Self-Review

- Every read starts with `requireTenantContext`; every mutation starts with `requireClientOwnerContext` inside the server implementation boundary.
- Every lead query includes explicit tenant and restriction predicates; RLS remains forced and support remains exact-session/audit-bound.
- Exact search hashes normalized email/phone before querying and never decrypts candidate collections.
- Decryption happens only after page/detail rows return.
- List/detail DTO construction is explicit and cannot spread database records into the client.
- Consent is reconstructed and validated as `ConsentReceiptV1`; unknown category keys are discarded.
- Audit chronology maps only four lead actions and explicit typed fields for the requested lead.
- The status matrix is literal in both TypeScript and SQL; terminal statuses cannot use ordinary transitions.
- Status/reopen/revenue updates lock the selected active tenant lead, update timestamps, and write audit inside one transaction.
- Audit failure rollback, non-won revenue denial, direct-write denial, cross-tenant not-found behavior, and support read-only behavior are covered by pgTAP.
- Revenue audit metadata contains only `recorded_on`; note ciphertext and amount are absent.
- Revenue note ciphertext is never selected by list/detail queries.
- Existing Task 1-5 authentication, tenant, support, audit, RLS, retention, branding, intake, consent, and crypto suites remain green.
- Generated database and route changes were narrowed to Task 6 signatures and routes; root/generated churn was not retained.

## Concerns And Residual Notes

- Terminal reopen deterministically returns `won` or `lost` leads to `qualified`; the brief requires a separate reopen action but does not name an alternate destination.
- The finite ISO 4217 allowlist includes current `XCG` and will need intentional migration/schema updates when the standard changes.
- The live smoke test covers server startup and the public login route only. Authenticated lead behavior is covered by component, server-boundary, pgTAP, typecheck, and production route-build verification rather than a seeded browser session.
- Vite continues to emit the existing `vite-tsconfig-paths` advisory; it is unrelated to Task 6.
