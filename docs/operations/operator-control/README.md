# Operator control foundation

This is a **local-only, inactive foundation**. It has not been deployed, connected to Supabase, populated with production data, or wired to any outbound, Attio, pricing, scope, signing, refund, code, or deployment capability. The general schema retains a `shadow` enum for possible future, separately reviewed work. The operator RPCs implemented here categorically accept synthetic runs only. The global kill switch and every operator default disabled.

## Later migration

After human review, use the project's normal Supabase migration process against an explicitly selected non-production environment first. The migration is `supabase/migrations/20260814133600_operator_control_foundation.sql`. Grant RPC execution only to a dedicated server role after reviewing each function; tables intentionally have RLS with no runtime policies.

Server adapter variables are `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. They are consumed only by server modules and must never have a `VITE_` prefix or reach browser output.

Not enabled: real users, production records, outbound messages, autonomous approvals, autonomous sends, deployment, pricing or scope changes, signatures, refunds, Attio, or external service calls.

## Phase 3 local database adapter and dashboard

This remains **local, synthetic-only, and inactive by default**. `SupabaseOperatorStore`
is a server-only PostgREST/RPC adapter; its service-role key must never use a `VITE_`
prefix or enter rendered HTML. Runtime table access remains revoked from browser roles.
All database/RPC failures deny execution. Approval consumption binds the exact SHA-256
payload hash and excludes every hard-prohibited action.

The control dashboard calls `assertDashboardAccess` on every read and mutation. It requires `OPERATOR_DASHBOARD_ENABLED` to be exactly `true`, a loopback Host, no forwarding headers, and a loopback peer address when the runtime exposes one. Host is not identity. If no peer address is available, a server-only high-entropy `OPERATOR_DASHBOARD_ACCESS_TOKEN` (at least 256 bits, provisioned as the `operator_dashboard_access` HttpOnly cookie) is required. There is no browser API that reveals this token. Mutations also require an Origin whose host matches Host. This is not claimed secure behind a proxy: proxied requests are rejected. Human mutations additionally
require `OPERATOR_DASHBOARD_MUTATIONS_ENABLED=true`; no mutation may authorize send,
deploy, pricing, scope, signing, or refunds. The default is read-only.

## Phase 5 synthetic draft review

The local dashboard now permits a configured local human to approve or reject only a
pending synthetic CRO draft by its exact payload hash. It requires all three dashboard,
mutation, and synthetic flags plus server-only `OPERATOR_LOCAL_HUMAN_ACTOR=local:<id>`.
The browser cannot choose the actor. A reason is mandatory. Approval records review but
leaves the draft unconsumed; rejection blocks the run. Neither decision sends, schedules,
authorizes outbound, changes commercial terms, deploys, signs, or refunds.

Run `npm run test:integration` for an isolated PostgreSQL 17 Docker test. It publishes
no host ports, creates browser roles, applies all local migrations, verifies denied
grants and decision invariants, and always removes the container. Docker unavailability fails unless `ALLOW_DOCKER_INTEGRATION_SKIP=true` explicitly opts into a skip. It never falls back to a hosted database.
