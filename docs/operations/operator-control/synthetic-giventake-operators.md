# Local synthetic GivenTake operators

These server-only operators are a **local behavior-test layer**, not a live sales system. They use injected stores and synthetic fixtures only. They have no network, Supabase, send, deployment, pricing, scoping, or deadline authority.

## Operators

- **CFO compliance gate** checks required fields, suppression, banned phrases, regulated-data signals, ambiguity, and ATC conflicts. Trades and ordinary small businesses are allowed. Restoration/public-adjuster/adjuster categories are flagged for Salem human review, not automatically rejected. Missing or ambiguous facts escalate. Output always says `sendAuthorized: false`.
- **CRO synthetic pipeline** accepts only `synthetic: true` leads, runs the CFO gate, maps the lead to a slug in `src/lib/offers.ts`, writes an individualized draft of at most 85 words with the charter-required automated-message disclosure footer, and marks it awaiting human review. It cannot send or introduce a price, scope, deadline, scarcity, proof, or outcome claim.
- **CTO synthetic public-site audit** examines supplied synthetic facts only. It never fetches a URL. It returns at most two supplied, verified gaps mapped to an existing offer; when none exist it reports no verified gaps. It cannot edit code or deploy.
- **Orchestrator** aggregates supplied operator results into one plain report with counts, blocks, escalations, review queue count, and explicit zero action authority.

## Controls and audit

Each operator calls the existing global/per-operator `requireControls` check in synthetic mode and fails closed. Each successful result must be appended through the injected audit store; audit failure blocks completion. The CFO is checked independently when invoked by the CRO. Production integrations and real prospect/client data are prohibited.

## Persisted synthetic lead path

Phase four adds a separate server-only path that accepts an exact allowlisted object only: controlled fixture ID/category/offer values, `synthetic: true`, `fixtureKind: local-synthetic`, `.invalid` email, and explicit synthetic markers. Unknown keys, unrestricted source text, and obvious personal, regulated, financial, credential, phone, or real-email data are rejected in TypeScript and PostgreSQL. It does not change or call the public contact form. The database atomically persists the fixture lead and run, the deterministic CFO result, and, only after a CFO pass, the CRO draft plus a pending human approval containing the exact immutable payload and its SHA-256 hash. Blocks and escalations stop before drafting. Duplicate terminal idempotency keys return the original run. A duplicate `running` run is resumable: deterministic stage writes are locked and idempotent so a retry after a partial failure can complete rather than strand the run.

The local dashboard displays the joined synthetic lead/run, compliance result, pending approval, and append-only audit sequence. Dashboard access requires localhost and `OPERATOR_DASHBOARD_ENABLED=true`. Any synthetic mutation additionally requires `OPERATOR_DASHBOARD_MUTATIONS_ENABLED=true`, `OPERATOR_SYNTHETIC_RUNS_ENABLED=true`, and a server-only `OPERATOR_LOCAL_HUMAN_ACTOR` in the form `local:<identifier>`. All flags are inactive by default.

Phase five adds approve/reject review controls only for pending synthetic CRO drafts. The browser supplies a required reason and the displayed exact payload hash, but never an actor. The server supplies the configured local actor. Approval means only “reviewed and acceptable as a draft for later manual handling”; it leaves the approval unconsumed and does not send, schedule, authorize outbound, change price/scope/deadline, deploy, sign, or refund. Rejection blocks the run. Either decision is atomic and appends an immutable audit event; stale, expired, revoked, hash-mismatched, consumed, disabled, or already-decided requests fail closed.

The narrow `SECURITY DEFINER` RPCs are executable only by `service_role`; browser roles have no table or RPC access. Missing controls, RPC errors, invalid fixtures, suppression, and audit/persistence failures fail closed. This local path has no outbound transport or send UI.

## Local verification

Run `npm test`, `npm run test:integration`, `npm run lint`, and `npm run build`. Behavioral fixtures use `.invalid` addresses and invented businesses only. The integration container publishes no host ports and is removed in a `finally` block.
