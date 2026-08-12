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

## Fix Round 1

Date: 2026-08-12

### Result

Addressed all seven Important findings without changing the root application or generated route tree:

- Replaced caller-settable GUC authorization with invoker-security triggers that compare `current_user` to the owner of the `SECURITY DEFINER` transaction functions. Authenticated callers cannot manufacture that role boundary; RLS still hides cross-tenant rows before a row trigger executes.
- Added immutable revenue history with `superseded_at`, a partial unique current-outcome index, append-only replacement recording, and atomic supersession when a won lead reopens.
- Persisted the immediate preterminal status and restored `new`, `qualified`, or `booked` exactly on reopen. Reopened leads expose no current revenue until won and recorded again.
- Restricted lifecycle audit metadata to finite change/status/date/count fields. Reopen reason, amount, note, and ciphertext never enter audit or client DTOs.
- Added the `amount_minor_text(revenue_outcomes)` database boundary and kept confirmed revenue as decimal strings through server DTOs and UI formatting.
- Added a deterministic ISO 4217 exponent map: zero-decimal currencies and no-minor-unit ISO units use 0, BHD/IQD/JOD/KWD/LYD/OMR/TND use 3, CLF/UYW use 4, and the maintained remainder uses 2.
- Added explicit tenant predicates for embedded attribution and revenue relations and shared tenant adapters for attribution, consent, audit, and current-revenue detail reads. Active lead reads retain `restricted_at is null`.
- Threaded parent support-session state into both lead routes. Support sees a clear read-only state and no status, reopen, or revenue controls.
- Owner mutations await route invalidation before displaying success, refreshing status, current revenue, audit chronology, and activity timestamps.
- Removed exact email/phone from GET route validation and links. Exact lookup and lookup pagination now use a POST server function and component-local state.

### RED Evidence

Focused application command from `growth-os/`:

```powershell
& '.\node_modules\.bin\vitest.exe' run src/features/leads --reporter=verbose
```

Result: failed as expected with 15 focused assertions covering the missing POST lookup schema/function, currency exponent formatting, explicit query adapters, bigint text mapping, reason-free audit DTO, support read-only route/component state, refresh sequencing, and PII-free pagination.

Direct database command against the unchanged Task 6 schema:

```powershell
& '.\node_modules\.bin\supabase.exe' test db supabase/tests/release1_task6_lead_ledger.test.sql
```

Result: failed as expected. Five of 32 assertions failed: both caller-set GUCs bypassed their direct-write guards, and the successful unauthorized status mutation contaminated three downstream transaction assertions.

Incremental embedded-scope command:

```powershell
& '.\node_modules\.bin\vitest.exe' run src/features/leads/leads.server.test.ts --reporter=dot
```

Result: 1 of 25 tests failed as expected because `scopeEmbeddedLeadRelations` did not yet exist. The passing implementation then asserted exact `attribution_touches.tenant_id`, `revenue_outcomes.tenant_id`, `revenue_outcomes.superseded_at is null`, parent `tenant_id`, and parent `restricted_at is null` predicates.

Incremental no-minor-unit ISO command:

```powershell
& '.\node_modules\.bin\vitest.exe' run src/features/leads/leads.server.test.ts --reporter=dot
```

Result: 1 of 25 tests failed as expected because XAU inherited the two-decimal default (`100` instead of `1`). The explicit no-minor-unit set corrected it.

### GREEN Evidence

Focused lead command:

```powershell
& '.\node_modules\.bin\vitest.exe' run src/features/leads --reporter=dot
```

Result: 4 files passed, 62 tests passed.

Focused real-database command:

```powershell
& '.\node_modules\.bin\supabase.exe' test db supabase/tests/release1_task6_fix_round1.test.sql
```

Result: 38 assertions passed. Coverage includes GUC spoofing, same-tenant direct-write denial, cross-tenant zero-row behavior, all requested reopen paths, current/history uniqueness, re-win, no lost current ledger values, exact bigint text above `Number.MAX_SAFE_INTEGER` and at PostgreSQL bigint max, finite audit metadata, composite tenant integrity, row locks, and the partial unique concurrency safeguard.

Clean reset and full pgTAP commands:

```powershell
& '.\node_modules\.bin\supabase.exe' db reset
npx --yes bun run test:db
```

Result: all 11 migrations applied from an empty database; 9 pgTAP files passed, 261 assertions passed.

Final Growth OS commands:

```powershell
npx --yes bun run test
npx --yes bun run typecheck
npx --yes bun run lint
npx --yes bun run build
```

Result: 16 files and 160 tests passed; typecheck and lint passed; production client and SSR builds passed with 1,920 client modules and 103 SSR modules. Generated routes remain `/leads` and `/leads/$leadId`, with no `routeTree.gen.ts` diff.

Final hygiene and scans:

```powershell
git diff --check
```

Result: passed. `growth-os/supabase/.branches` was physically removed, no root application files changed, and scans found no client bundle/source matches for service or crypto keys, ciphertext/hash/internal ledger columns, support internals, fixture PII, lead logging, PII route parameters, or migration GUC authorization.

The running local application at `http://127.0.0.1:4174/login` returned HTTP 200 and rendered Growth OS.

### Fix Round 1 Changed Files

- `.superpowers/sdd/2026-08-09-giventake-growth-os-release-1/task-6-report.md`
- `growth-os/src/features/audit/audit.server.ts`
- `growth-os/src/features/leads/lead-detail.tsx`
- `growth-os/src/features/leads/lead-list.tsx`
- `growth-os/src/features/leads/lead-routes.test.tsx`
- `growth-os/src/features/leads/lead-ui.test.tsx`
- `growth-os/src/features/leads/lead.schemas.ts`
- `growth-os/src/features/leads/leads.functions.ts`
- `growth-os/src/features/leads/leads.server.test.ts`
- `growth-os/src/features/leads/leads.server.ts`
- `growth-os/src/lib/database.types.ts`
- `growth-os/src/routes/_app.leads.$leadId.tsx`
- `growth-os/src/routes/_app.leads.tsx`
- `growth-os/supabase/migrations/202608120010_task6_lead_ledger.sql`
- `growth-os/supabase/migrations/202608120011_task6_fix_round1.sql`
- `growth-os/supabase/tests/release1_task6_lead_ledger.test.sql`
- `growth-os/supabase/tests/release1_task6_fix_round1.test.sql`

### Fix Round 1 Self-Review

- The old and invented GUC names appear only in adversarial pgTAP and no migration function reads or sets custom authorization state.
- Invoker triggers reject authenticated direct writes while transaction RPCs execute DML as their database owner; direct cross-tenant updates still touch no visible row and do not fire the guard.
- Every lifecycle RPC locks the active tenant lead before state decisions. The partial unique index provides the final one-current-row guarantee under concurrent revenue attempts.
- Revenue replacement updates only supersession metadata on the prior current row and inserts a new row; previous amount, currency, date, actor, and encrypted note remain historical.
- Reopen atomically restores `preterminal_status`, clears it on the nonterminal lead, supersedes current revenue, updates activity, and writes one finite audit event.
- List and detail select only `amount_minor_text`; no code path reads `amount_minor` through a JavaScript number.
- Exact lookup still HMACs normalized values server-side and decrypts only returned rows, but PII is absent from route search, form actions, browser history, and pagination hrefs.
- Support read-only state comes from the exact-session parent loader; server mutation ownership checks remain the authoritative denial.
- Mutation success is set only after awaited route invalidation.
- Client DTOs and UI expose no reopen reason, revenue note, historical internal values, storage column, lookup hash, or support capability detail.

### Fix Round 1 Concerns And Maintenance

- The finite ISO 4217 code allowlist and exponent exceptions are maintained data. Standard changes require an intentional SQL allowlist and TypeScript exponent-map update together.
- Concurrency is verified through lead-row `FOR UPDATE` checks, the partial unique current-outcome index, and transactional pgTAP flows. The local pgTAP harness does not run a separate multi-connection race.
- The authenticated lead routes remain covered by server, component, route, and database tests rather than a seeded browser login. The live route smoke check covers the public login response.
- Vite continues to emit the existing `vite-tsconfig-paths` advisory; this round does not broaden into that separate cleanup.
