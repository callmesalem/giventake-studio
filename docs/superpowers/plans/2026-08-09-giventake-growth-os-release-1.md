# GivenTake Growth OS Release 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-capable Growth OS release: two isolated branded tenants can receive consent-safe website leads, connect read-only GA4/Google Ads/Meta data, confirm outcomes and revenue, and inspect trustworthy attribution and ROI.

**Architecture:** Add `growth-os/` as a separately deployed TanStack Start application while keeping the existing public website at the repository root. Use Supabase Auth and managed Postgres with row-level security; all private data, provider calls, OAuth credentials, synchronization, and dashboard queries cross server-only boundaries. Share only the versioned lead-ingestion contract with the public site, which signs each submission server-side and degrades to its existing email or mail-client path when Growth OS is unavailable.

**Tech Stack:** Bun, React 19, TanStack Start, TypeScript, Zod, Tailwind CSS, Recharts, Supabase Auth/Postgres/RLS, Web Crypto AES-256-GCM and HMAC-SHA-256, Vitest, Testing Library, pgTAP through Supabase CLI, Playwright.

## Global Constraints

- Release 1 is a separate authenticated application under a GivenTake-controlled domain such as `app.giventakedevs.com`.
- The current public website remains independently buildable and deployable from the repository root.
- Every tenant-owned database row contains `tenant_id`; Postgres RLS denies cross-tenant access even when application code supplies the wrong identifier.
- Only `platform_admin` and `client_owner` roles exist in Release 1.
- Platform-administrator access to client data requires an explicit, time-limited, audited support session; impersonation is prohibited.
- Client branding includes display name, logo, colors, and report identity in Release 1; custom domains wait for Release 4.
- The lead ledger is the source of truth for `new`, `qualified`, `booked`, `won`, and `lost` outcomes.
- Confirmed revenue is entered by a human and is never inferred from an ad platform or AI.
- Deterministic attribution precedence is declared source, valid click/provider reference, UTM campaign, referring domain, then direct/unknown.
- First-touch and last-touch attribution retain evidence and `high`, `medium`, or `low` confidence; ambiguity and unattributed results remain visible.
- Google Analytics 4, Google Ads, and Meta Ads connections are read-only in Release 1.
- AI analysis, campaign publishing, outreach, media purchases, individual identification, and autonomous decisions are outside Release 1.
- The website form remains functional when analytics or marketing consent is denied and when Growth OS is unavailable.
- Analytics and advertising provider events remain consent-gated; Global Privacy Control (GPC) disables covered marketing behavior; names, email addresses, phone numbers, notes, and sensitive data never enter analytics event properties.
- Raw IP addresses, precise location trails, device fingerprints, and advertising-ID location histories are not stored.
- Personal data is not sold, pooled across clients, used to build cross-client audiences, or enriched from scraped profiles; Release 1 contains no scraper or crawler for identifying people.
- Sensitive-location audiences and sensitive personal categories are excluded from every persisted attribution and provider payload.
- Geographic cells are not exposed in Release 1; future geographic output must contain at least 100 users or households and honor any higher provider threshold.
- Provider troubleshooting payloads expire after 7 days; normalized campaign metrics and security audit events after 25 months; pseudonymous website detail after 13 months; lead contact/outcome data after 24 months from last activity unless a tenant selects a shorter period or documents a lawful longer period.
- Every accepted lead or provider event has a consent receipt.
- Missing or stale data is labeled unavailable or stale, never represented as a real zero.
- Division by zero returns `null` and renders as unavailable, never infinity or zero.
- External effects always require human approval; no Release 1 server credential can publish, send outreach, change targeting, or spend money.
- Secrets are read inside server handlers or server-only functions, never at module initialization and never from `VITE_*` variables.
- All server functions and server routes that touch private data enforce authentication and authorization at the handler boundary; route guards are only a user-experience layer.
- Use integer minor currency units (`bigint` cents for USD) in storage and convert to display values only at the presentation boundary.
- Keep all edited text and source ASCII unless an existing file requires another character set.

---

## File Structure

### Repository And Shared Contract

- Modify `package.json`: declare Bun workspaces and add root commands for the separate Growth OS package without changing the root website's existing `dev`, `build`, or `lint` commands.
- Modify `eslint.config.js`: exclude the nested app from the root lint pass because `growth-os/` owns its lint configuration.
- Create `packages/growth-os-contract/package.json`: private shared package metadata.
- Create `packages/growth-os-contract/src/index.ts`: versioned lead event, consent receipt, attribution, and acknowledgment schemas.
- Create `packages/growth-os-contract/src/index.test.ts`: contract sanitization and rejection tests.

### Growth OS Application Shell

- Create `growth-os/package.json`, `growth-os/tsconfig.json`, `growth-os/vite.config.ts`, `growth-os/eslint.config.js`, `growth-os/vitest.config.ts`, `growth-os/playwright.config.ts`, and `growth-os/.env.example`: isolated application and test configuration.
- Create `growth-os/src/start.ts`, `growth-os/src/server.ts`, `growth-os/src/router.tsx`, `growth-os/src/routes/__root.tsx`, and `growth-os/src/styles.css`: TanStack Start runtime, CSRF middleware, root UI, and restrained operational design system.
- Create `growth-os/src/lib/domain.ts`: canonical provider union shared by metrics, connectors, and dashboard code.
- Create `growth-os/src/components/ui/*`: only the shadcn primitives used by the application.

### Data, Identity, And Authorization

- Create `growth-os/supabase/config.toml`: local Supabase project configuration.
- Create `growth-os/supabase/migrations/202608090001_release1_core.sql`: enums, tables, constraints, indexes, timestamps, and immutable audit trigger.
- Create `growth-os/supabase/migrations/202608090002_release1_rls.sql`: RLS helpers and policies for every tenant-owned table.
- Create `growth-os/supabase/migrations/202608090003_release1_jobs.sql`: transactional metric publication, support-session, deletion, and retention functions.
- Create `growth-os/supabase/tests/release1_rls.test.sql`: pgTAP tenant-isolation, role, support-session, and immutability tests.
- Create `growth-os/src/lib/database.types.ts`: Supabase-generated database types.
- Create `growth-os/src/lib/server/supabase.server.ts`: cookie-aware user client and server-only job client.
- Create `growth-os/src/features/auth/*`: email magic-link sign-in, callback, sign-out, invitation acceptance, and authenticated session functions.
- Create `growth-os/src/features/tenants/*`: active-tenant resolution, role checks, tenant selection, support sessions, and tests.

### Leads, Revenue, Attribution, And Intake

- Create `growth-os/src/lib/server/crypto.server.ts`: versioned AES-256-GCM encryption plus deterministic HMAC lookup hashes.
- Create `growth-os/src/features/intake/*`: HMAC verification, replay protection, payload limits, event ingestion, and tests.
- Create `growth-os/src/routes/api.ingest.v1.leads.ts`: public signed lead-ingestion server route.
- Create `src/lib/growth-os-ingest.ts`: server-only website client that signs and submits a lead without logging personal data.
- Modify `src/lib/intake-schema.ts`, `src/lib/intake.ts`, `src/components/sections/contact.tsx`, and `.env.example`: add the consent receipt and resilient Growth OS delivery alongside the current email fallback.
- Create `growth-os/src/features/leads/*`: encrypted lead persistence, list/detail queries, state transitions, confirmed revenue, UI, and tests.
- Create `growth-os/src/features/attribution/*`: deterministic attribution, confidence, manual correction, recomputation, and tests.
- Create `growth-os/src/features/metrics/*`: ROI calculations, date-window completeness, overview query, and tests.

### Connectors And Synchronization

- Create `growth-os/src/features/connectors/core/*`: provider contracts, OAuth state, encrypted credentials, retry policy, normalization types, health, and transaction publication.
- Create `growth-os/src/features/connectors/google-analytics/*`: GA4 authorization, account/property selection, `runReport` import, fixtures, and contract tests.
- Create `growth-os/src/features/connectors/google-ads/*`: Google Ads authorization, account selection, GAQL import, fixtures, and contract tests.
- Create `growth-os/src/features/connectors/meta-ads/*`: Meta authorization, account selection, paginated Insights import, fixtures, and contract tests.
- Create `growth-os/src/routes/api.oauth.$provider.callback.ts`, `growth-os/src/routes/api.jobs.sync.ts`, and `growth-os/src/routes/api.jobs.retention.ts`: external OAuth and authenticated scheduler endpoints.

### Dashboard, Privacy, And Operations

- Create `growth-os/src/features/dashboard/*` and authenticated routes under `growth-os/src/routes/_app*`: application shell, overview, leads, channels, reports, connections, and settings.
- Create `growth-os/src/features/privacy/*`: export, restriction, deletion, retention, and audit views plus tests.
- Create `growth-os/tests/e2e/release1.spec.ts`: complete two-tenant browser flow and cross-tenant denial checks.
- Create `growth-os/supabase/seed.sql`: GivenTake and pilot test tenants with deterministic de-identified records.
- Create `docs/operations/growth-os-release1-runbook.md`: environments, connector setup, sync recovery, encryption-key rotation, backup restore drill, retention, deletion, and pilot checklist.
- Modify `docs/contracts/subprocessor-list.md`, `docs/contracts/msa-template.md`, and `src/routes/privacy.tsx`: disclose only the processors and data flows actually enabled before external pilot data is connected.

---

### Task 1: Scaffold The Separate Application And Shared Contract

**Files:**
- Modify: `package.json`
- Modify: `eslint.config.js`
- Create: `packages/growth-os-contract/package.json`
- Create: `packages/growth-os-contract/src/index.ts`
- Create: `packages/growth-os-contract/src/index.test.ts`
- Create: `growth-os/package.json`
- Create: `growth-os/tsconfig.json`
- Create: `growth-os/vite.config.ts`
- Create: `growth-os/eslint.config.js`
- Create: `growth-os/vitest.config.ts`
- Create: `growth-os/playwright.config.ts`
- Create: `growth-os/.env.example`
- Create: `growth-os/src/start.ts`
- Create: `growth-os/src/server.ts`
- Create: `growth-os/src/router.tsx`
- Create: `growth-os/src/routes/__root.tsx`
- Create: `growth-os/src/routes/index.tsx`
- Create: `growth-os/src/styles.css`
- Create: `growth-os/src/lib/domain.ts`

**Interfaces:**
- Produces: workspace package `@giventake/growth-os-contract`.
- Produces: `LeadEventV1`, `ConsentReceiptV1`, `leadEventV1Schema`, and `LeadEventAck`.
- Produces: `PROVIDERS` and `Provider = "google_analytics" | "google_ads" | "meta_ads"` from `growth-os/src/lib/domain.ts`.
- Produces: root commands `growth:dev`, `growth:test`, `growth:lint`, `growth:typecheck`, `growth:build`, and `growth:e2e`.
- Produces: a separately runnable application on the next free local port.

- [ ] **Step 1: Write the failing shared-contract test**

Create `packages/growth-os-contract/src/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { leadEventV1Schema } from "./index";

const valid = {
  schema_version: 1,
  event_id: "7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4",
  occurred_at: "2026-08-09T16:00:00.000Z",
  lead: {
    name: "Test Lead",
    email: "lead@example.com",
    company: "Example Service",
    phone: null,
    notes: "Needs a new intake website.",
    budget_range: "5k-10k",
    timeline_range: "1-2-months",
  },
  attribution: {
    declared_source: "google",
    source_detail: null,
    landing_page: "https://giventakedevs.com/",
    offer_id: "project-brief",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "launch",
    utm_content: null,
    utm_term: null,
    referrer_domain: "google.com",
    click_ids: { gclid: "safe-click-id" },
  },
  consent: {
    policy_version: "privacy-2026-08-08",
    source: "contact-form",
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
    contact_requested: true,
    gpc: false,
    recorded_at: "2026-08-09T16:00:00.000Z",
  },
};

describe("leadEventV1Schema", () => {
  it("accepts a necessary lead when optional tracking consent is denied", () => {
    expect(leadEventV1Schema.parse(valid).consent.marketing).toBe(false);
  });

  it.each(["ip", "latitude", "longitude", "fingerprint", "advertising_id"])(
    "rejects prohibited field %s",
    (field) => {
      expect(() => leadEventV1Schema.parse({ ...valid, [field]: "forbidden" })).toThrow();
    },
  );

  it("rejects personal data inside attribution evidence", () => {
    expect(() =>
      leadEventV1Schema.parse({
        ...valid,
        attribution: { ...valid.attribution, email: "lead@example.com" },
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `bunx vitest run packages/growth-os-contract/src/index.test.ts`

Expected: FAIL because `packages/growth-os-contract/src/index.ts` does not exist.

- [ ] **Step 3: Define the exact versioned contract**

Create `packages/growth-os-contract/src/index.ts` with strict Zod objects. Use `.strict()` on every object, cap free text at 1,500 characters, cap attribution strings at 200 characters, accept only `gclid`, `gbraid`, `wbraid`, `fbclid`, and require `necessary` plus `contact_requested` to be `true`:

```ts
import { z } from "zod";

const nullableShort = z.string().trim().min(1).max(200).nullable();
const isoDate = z.string().datetime({ offset: true });

export const consentReceiptV1Schema = z
  .object({
    policy_version: z.string().trim().min(1).max(80),
    source: z.literal("contact-form"),
    necessary: z.literal(true),
    analytics: z.boolean(),
    marketing: z.boolean(),
    preferences: z.boolean(),
    contact_requested: z.literal(true),
    gpc: z.boolean(),
    recorded_at: isoDate,
  })
  .strict();

export const leadEventV1Schema = z
  .object({
    schema_version: z.literal(1),
    event_id: z.string().uuid(),
    occurred_at: isoDate,
    lead: z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(255),
        company: z.string().trim().min(1).max(120).nullable(),
        phone: z.string().trim().min(7).max(32).nullable(),
        notes: z.string().trim().min(10).max(1500),
        budget_range: z.string().trim().min(1).max(80),
        timeline_range: z.string().trim().min(1).max(80),
      })
      .strict(),
    attribution: z
      .object({
        declared_source: z.string().trim().min(1).max(80),
        source_detail: nullableShort,
        landing_page: z.string().url().max(500),
        offer_id: z.string().trim().min(1).max(100),
        utm_source: nullableShort,
        utm_medium: nullableShort,
        utm_campaign: nullableShort,
        utm_content: nullableShort,
        utm_term: nullableShort,
        referrer_domain: nullableShort,
        click_ids: z
          .object({
            gclid: nullableShort.optional(),
            gbraid: nullableShort.optional(),
            wbraid: nullableShort.optional(),
            fbclid: nullableShort.optional(),
          })
          .strict(),
      })
      .strict(),
    consent: consentReceiptV1Schema,
  })
  .strict();

export type ConsentReceiptV1 = z.infer<typeof consentReceiptV1Schema>;
export type LeadEventV1 = z.infer<typeof leadEventV1Schema>;
export type LeadEventAck = { status: "accepted" | "duplicate"; lead_id: string };
```

- [ ] **Step 4: Scaffold the nested TanStack Start package**

Add `workspaces: ["growth-os", "packages/*"]` to the root `package.json`. Keep every existing root script unchanged and add:

```json
{
  "growth:dev": "bun --cwd growth-os dev",
  "growth:test": "bun --cwd growth-os test",
  "growth:lint": "bun --cwd growth-os lint",
  "growth:typecheck": "bun --cwd growth-os typecheck",
  "growth:build": "bun --cwd growth-os build",
  "growth:e2e": "bun --cwd growth-os e2e"
}
```

Create `growth-os/package.json` with the root app's React, TanStack Start, Zod, Tailwind, Radix, Lucide, Recharts, and Vite versions. Add `@supabase/ssr`, `@supabase/supabase-js`, and `@giventake/growth-os-contract: "workspace:*"`; add Vitest, Testing Library, jsdom, Playwright, and Supabase CLI as dev dependencies. Define scripts:

```json
{
  "dev": "vite dev",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:db": "supabase test db",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "e2e": "playwright test"
}
```

Create the shared package metadata exactly as:

```json
{
  "name": "@giventake/growth-os-contract",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "zod": "^3.24.2" },
  "devDependencies": { "vitest": "^3.2.4" }
}
```

Use the existing root TanStack files as the starting convention, but configure `growth-os/vite.config.ts` directly with `tanstackStart`, React, Tailwind, and tsconfig paths so the new app is not coupled to Lovable's root-only Vite package. In `growth-os/src/start.ts`, install CSRF protection for every server function:

```ts
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

const csrf = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({ requestMiddleware: [csrf] }));
```

Add `growth-os/**` and `packages/**/dist/**` to the root ESLint ignore list. The nested ESLint config owns the new app.

Create the provider domain once and import it everywhere else:

```ts
export const PROVIDERS = ["google_analytics", "google_ads", "meta_ads"] as const;
export type Provider = (typeof PROVIDERS)[number];
```

- [ ] **Step 5: Verify both applications are independent**

Run: `bun install && bunx vitest run packages/growth-os-contract/src/index.test.ts && bun run build && bun run growth:typecheck && bun run growth:build`

Expected: contract tests PASS; the existing public site build PASS; the new Growth OS typecheck and build PASS.

- [ ] **Step 6: Commit the scaffold**

```bash
git add package.json bun.lock eslint.config.js packages/growth-os-contract growth-os
git commit -m "feat: scaffold Growth OS application"
```

### Task 2: Create The Tenant Data Model And RLS Boundary

**Files:**
- Create: `growth-os/supabase/config.toml`
- Create: `growth-os/supabase/migrations/202608090001_release1_core.sql`
- Create: `growth-os/supabase/migrations/202608090002_release1_rls.sql`
- Create: `growth-os/supabase/migrations/202608090003_release1_jobs.sql`
- Create: `growth-os/supabase/tests/release1_rls.test.sql`
- Create: `growth-os/src/lib/database.types.ts`

**Interfaces:**
- Produces: tenant tables named in the design plus `platform_admins`, `support_sessions`, `provider_accounts`, `sync_payloads`, `ingest_idempotency`, and `privacy_requests`.
- Produces: SQL helpers `can_access_tenant(uuid)`, `is_client_owner(uuid)`, `has_active_support_session(uuid)`, and `write_audit_event(...)`.
- Produces: transactional RPCs `publish_metric_window(...)`, `start_support_session(...)`, `restrict_privacy_subject(...)`, and `run_retention_cleanup(...)`.

- [ ] **Step 1: Write failing pgTAP isolation tests**

Create `growth-os/supabase/tests/release1_rls.test.sql`. Seed two `auth.users`, two tenants, one owner membership per tenant, and one platform admin. Assert all of the following with pgTAP:

```sql
select plan(18);

select lives_ok(
  $$ select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true) $$,
  'tenant A owner identity is active'
);
select is((select count(*) from public.leads)::bigint, 1::bigint, 'owner sees tenant A lead');
select is((select count(*) from public.leads where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::bigint, 0::bigint, 'owner cannot see tenant B lead');
select throws_ok(
  $$ update public.leads set status = 'won' where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  '42501',
  null,
  'owner cannot update tenant B lead'
);
select is((select count(*) from public.audit_events where tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::bigint, 0::bigint, 'owner cannot read tenant B audit');
select throws_ok(
  $$ update public.audit_events set action = 'changed' $$,
  '42501',
  null,
  'audit events are immutable'
);
```

Complete the 18 assertions with insert, select, update, and delete checks for `brands`, `sites`, `connections`, `campaigns`, `campaign_metrics_daily`, `revenue_outcomes`, `consent_receipts`, and `privacy_requests`; verify a platform admin sees no client data before `start_support_session`, sees only the chosen tenant during a valid session, and loses access after expiry.

- [ ] **Step 2: Start local Supabase and verify the tests fail**

Run: `cd growth-os && bunx supabase start && bunx supabase test db`

Expected: FAIL because the release tables and policies do not exist.

- [ ] **Step 3: Create the core schema with explicit constraints**

In `202608090001_release1_core.sql`, enable `pgcrypto` and create enums for tenant lifecycle, membership role, lead status, attribution touch/confidence, provider, connection health, sync status, and privacy-request state. Attribution touch values are exactly `unresolved`, `first`, `last`, and `manual`. Create all tables from the design plus `membership_invitations` for one-time owner invitations and `attribution_evidence` for immutable raw attribution inputs. Apply these required shapes:

```sql
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (char_length(display_name) between 1 and 120),
  status tenant_status not null default 'active',
  timezone text not null default 'America/New_York',
  currency char(3) not null default 'USD',
  lead_retention_months smallint not null default 24 check (lead_retention_months between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role membership_role not null check (role = 'client_owner'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id),
  external_event_id uuid not null,
  status lead_status not null default 'new',
  name_ciphertext text not null,
  email_ciphertext text not null,
  email_lookup_hash text not null,
  phone_ciphertext text,
  company_ciphertext text,
  notes_ciphertext text not null,
  declared_source text not null,
  source_detail text,
  budget_range text not null,
  timeline_range text not null,
  occurred_at timestamptz not null,
  last_activity_at timestamptz not null default now(),
  restricted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_event_id)
);

create table public.campaign_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null references public.connections(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  metric_date date not null,
  currency char(3) not null,
  impressions bigint,
  clicks bigint,
  sessions bigint,
  engaged_sessions bigint,
  users_count bigint,
  spend_minor bigint,
  provider_conversions numeric(18, 6),
  provider_conversion_value_minor bigint,
  is_complete boolean not null default false,
  source_updated_at timestamptz,
  published_at timestamptz not null default now(),
  unique (tenant_id, connection_id, campaign_id, metric_date)
);

create table public.consent_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  connection_id uuid references public.connections(id) on delete cascade,
  sync_run_id uuid references public.sync_runs(id) on delete cascade,
  receipt_type text not null check (receipt_type in ('website_lead', 'provider_import')),
  policy_version text not null,
  processing_basis text not null check (processing_basis in ('contact_request', 'account_authorization')),
  categories jsonb not null check (jsonb_typeof(categories) = 'object'),
  source text not null,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (
    (receipt_type = 'website_lead' and lead_id is not null and connection_id is null and sync_run_id is null)
    or
    (receipt_type = 'provider_import' and lead_id is null and connection_id is not null and sync_run_id is not null)
  )
);
```

The remaining table contracts are fixed as follows:

- `brands`: one row per tenant; `display_name`, HTTPS `logo_url`, six-digit `primary_color`, `accent_color`, `on_primary_color`, `report_name`, timestamps.
- `platform_admins`: unique `user_id`, granting actor, creation timestamp; no tenant data columns.
- `membership_invitations`: tenant, lowercased email, `client_owner`, inviter, single-use token hash, expiry, accepted timestamp; unique active invitation per tenant/email.
- `support_sessions`: tenant, admin user, 10-500 character reason, start, expiry no later than 60 minutes, optional revoke timestamp.
- `sites`: tenant, verified HTTPS origin, key id unique per tenant, encrypted signing secret, enabled flag, 120-request-per-minute limit, verification timestamp.
- `connections`: tenant, provider, encrypted credential envelope, granted scope array, selected external account id/name, currency, timezone, health, checkpoint, last success, next retry, revoked timestamp; unique provider/account within tenant.
- `provider_accounts`: tenant, connection, provider external id, display name, currency, timezone, selected flag; unique external id within tenant/provider.
- `sync_runs`: tenant, connection, bounded window, attempt number, status, checkpoint before/after, imported/published counts, sanitized error code, start/end timestamps.
- `sync_payloads`: tenant, sync run, connector-purpose ciphertext, created timestamp, expiry exactly seven days later.
- `campaigns`: tenant, connection, provider external id, name, normalized status, created/updated timestamps; unique external id within tenant/connection.
- `ingest_idempotency`: tenant, site, UUID key, SHA-256 body digest, lead id, accepted timestamp; primary key `(tenant_id, site_id, idempotency_key)` so a reused key with a different digest is a conflict.
- `attribution_evidence`: tenant, lead, occurred timestamp, declared source/detail, UTM fields, referrer domain, allowlisted click-id JSON, landing origin/path, offer id; no contact or precise-location fields.
- `attribution_touches`: tenant, lead, evidence, `unresolved|first|last|manual`, normalized source, optional campaign, confidence, state, reason-code array, manual actor/reason, created timestamp.
- `revenue_outcomes`: tenant, lead, positive `amount_minor`, ISO 4217 currency, confirmation date, actor, optional encrypted note, created/updated timestamps; at most one current confirmed outcome per lead.
- `audit_events`: tenant, actor, fixed action, target type/id, request id, sanitized JSON metadata, immutable timestamp.
- `privacy_requests`: tenant, request type/state, HMAC subject lookup, requester/verification timestamps, restricted/completed timestamps, sanitized failure code; no newly collected plaintext identity.

Use ciphertext columns for lead contact fields, connector credentials, and optional seven-day sync payloads. Do not create columns named `ip`, `ip_address`, `latitude`, `longitude`, `fingerprint`, `device_id`, or `advertising_id`. Add tenant-prefixed unique indexes for every provider external identifier and idempotency key.

- [ ] **Step 4: Add reusable RLS policies and audited support access**

In `202608090002_release1_rls.sql`, enable and force RLS on every tenant-owned table. Define `can_access_tenant` as membership access OR a valid support session; never grant all-tenant access to platform admins:

```sql
create or replace function public.can_access_tenant(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = target_tenant and m.user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.support_sessions s
    join public.platform_admins a on a.user_id = s.admin_user_id
    where s.tenant_id = target_tenant
      and s.admin_user_id = (select auth.uid())
      and s.revoked_at is null
      and s.expires_at > now()
  );
$$;

create policy tenant_select on public.leads
for select using (public.can_access_tenant(tenant_id));

create policy owner_update on public.leads
for update using (public.is_client_owner(tenant_id))
with check (public.is_client_owner(tenant_id));
```

Repeat explicit select/insert/update/delete policies for every tenant-owned table. `audit_events` permits select through `can_access_tenant` and insert only through `write_audit_event`; it has no update or delete policy. `platform_admins` and `support_sessions` are denied to ordinary authenticated users.

- [ ] **Step 5: Add transactional database functions**

In `202608090003_release1_jobs.sql`, implement:

```sql
create or replace function public.publish_metric_window(
  target_tenant uuid,
  target_connection uuid,
  window_start date,
  window_end date,
  rows_payload jsonb,
  completed_at timestamptz
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare published_count integer;
begin
  if window_end < window_start or window_end - window_start > 31 then
    raise exception 'invalid sync window';
  end if;
  if not exists (
    select 1 from public.connections
    where id = target_connection and tenant_id = target_tenant
  ) then
    raise exception 'connection not found';
  end if;
  delete from public.campaign_metrics_daily
  where tenant_id = target_tenant
    and connection_id = target_connection
    and metric_date between window_start and window_end;
  insert into public.campaign_metrics_daily (
    tenant_id, connection_id, campaign_id, metric_date, currency,
    impressions, clicks, sessions, engaged_sessions, users_count,
    spend_minor, provider_conversions, provider_conversion_value_minor,
    is_complete, source_updated_at
  )
  select target_tenant, target_connection, x.campaign_id, x.metric_date,
    x.currency, x.impressions, x.clicks, x.sessions, x.engaged_sessions,
    x.users_count, x.spend_minor, x.provider_conversions,
    x.provider_conversion_value_minor, true, completed_at
  from jsonb_to_recordset(rows_payload) as x(
    campaign_id uuid, metric_date date, currency char(3), impressions bigint,
    clicks bigint, sessions bigint, engaged_sessions bigint, users_count bigint,
    spend_minor bigint, provider_conversions numeric, provider_conversion_value_minor bigint
  );
  get diagnostics published_count = row_count;
  return published_count;
end;
$$;
```

Restrict execution of job functions to the service role. Implement `start_support_session` with a required 10-500 character reason, a maximum 60-minute expiry, and an audit event in the same transaction. Implement retention as small batches of at most 500 records per table so the scheduled endpoint can repeat safely.

- [ ] **Step 6: Generate database types and verify RLS**

Run: `cd growth-os && bunx supabase db reset && bunx supabase test db && bunx supabase gen types typescript --local --schema public > src/lib/database.types.ts && bun run typecheck`

Expected: 18 pgTAP assertions PASS and TypeScript PASS.

- [ ] **Step 7: Commit the database boundary**

```bash
git add growth-os/supabase growth-os/src/lib/database.types.ts
git commit -m "feat: enforce Growth OS tenant isolation"
```

### Task 3: Implement Server-Side Authentication And Active-Tenant Resolution

**Files:**
- Create: `growth-os/src/lib/server/supabase.server.ts`
- Create: `growth-os/src/features/auth/auth.schemas.ts`
- Create: `growth-os/src/features/auth/auth.server.ts`
- Create: `growth-os/src/features/auth/auth.functions.ts`
- Create: `growth-os/src/features/auth/auth.server.test.ts`
- Create: `growth-os/src/features/tenants/tenant-context.server.ts`
- Create: `growth-os/src/features/tenants/tenant-context.functions.ts`
- Create: `growth-os/src/features/tenants/tenant-context.server.test.ts`
- Create: `growth-os/src/routes/login.tsx`
- Create: `growth-os/src/routes/auth.callback.ts`
- Create: `growth-os/src/routes/select-tenant.tsx`
- Create: `growth-os/src/routes/_app.tsx`

**Interfaces:**
- Produces: `createUserSupabase(): SupabaseClient<Database>` and `createJobSupabase(): SupabaseClient<Database>`.
- Produces: `getAuthenticatedUser(): Promise<AuthUser | null>` and `requireAuthenticatedUser(): Promise<AuthUser>`.
- Produces: `requireTenantContext(): Promise<TenantContext>` for reads and `requireClientOwnerContext(): Promise<ClientOwnerContext>` for tenant mutations.
- Produces: server functions `requestMagicLink`, `signOut`, `listAvailableTenants`, and `selectTenant`.
- Produces: `getRouteSession(): Promise<{ authenticated: boolean; tenantSelected: boolean }>` and `AuthenticatedLayout` in `_app.tsx`.
- Produces: `ClientOwnerContext = { userId: string; tenantId: string; role: "client_owner"; supportSessionId: null }` and `TenantContext = ClientOwnerContext | { userId: string; tenantId: string; role: "platform_admin"; supportSessionId: string }`.

- [ ] **Step 1: Write failing tenant-context tests**

Create focused Vitest tests with injected auth and query adapters:

```ts
import { describe, expect, it, vi } from "vitest";
import { resolveTenantContext } from "./tenant-context.server";

describe("resolveTenantContext", () => {
  it("denies a missing authenticated user", async () => {
    await expect(
      resolveTenantContext({ userId: null, requestedTenantId: null, memberships: [] }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("does not accept a tenant id without membership", async () => {
    await expect(
      resolveTenantContext({
        userId: "11111111-1111-1111-1111-111111111111",
        requestedTenantId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        memberships: [
          { tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", role: "client_owner" },
        ],
      }),
    ).rejects.toMatchObject({ code: "TENANT_FORBIDDEN" });
  });

  it("requires tenant selection when an owner belongs to two tenants", async () => {
    await expect(
      resolveTenantContext({
        userId: "11111111-1111-1111-1111-111111111111",
        requestedTenantId: null,
        memberships: [
          { tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", role: "client_owner" },
          { tenantId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", role: "client_owner" },
        ],
      }),
    ).rejects.toMatchObject({ code: "TENANT_SELECTION_REQUIRED" });
  });
});
```

- [ ] **Step 2: Run the auth tests to verify they fail**

Run: `cd growth-os && bunx vitest run src/features/auth src/features/tenants`

Expected: FAIL because the auth and tenant modules do not exist.

- [ ] **Step 3: Create cookie-aware Supabase clients**

In `supabase.server.ts`, mark the module server-only and adapt Supabase SSR cookies through TanStack Start. Read every environment variable inside the function call:

```ts
import "@tanstack/react-start/server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader, setCookie } from "@tanstack/react-start/server";
import { parse } from "cookie";
import type { Database } from "../database.types";

export function createUserSupabase() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase user client is not configured");

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        const values = parse(getRequestHeader("cookie") ?? "");
        return Object.entries(values).flatMap(([name, value]) =>
          value ? [{ name, value }] : [],
        );
      },
      setAll(values) {
        for (const { name, value, options } of values) {
          setCookie(name, value, { ...options, httpOnly: true, sameSite: "lax" });
        }
      },
    },
  });
}

export function createJobSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase job client is not configured");
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

No component, route loader, or client-safe module may import `createJobSupabase`.

- [ ] **Step 4: Implement magic-link auth and invitation acceptance**

Validate email input with Zod. `requestMagicLink` calls `supabase.auth.signInWithOtp` with `emailRedirectTo: ${APP_URL}/auth/callback` and always returns `{ accepted: true }` so the UI does not reveal account existence. In `auth.callback.ts`, exchange the `code` query parameter with `exchangeCodeForSession`, then redirect to `/select-tenant`. `signOut` clears the Supabase session and the `gt_active_tenant` cookie.

Use this exact public user shape:

```ts
export type AuthUser = {
  id: string;
  email: string;
};

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const { data, error } = await createUserSupabase().auth.getUser();
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}
```

Create invitations only from a platform-admin server function using `auth.admin.inviteUserByEmail`. Require an existing target tenant and insert the `client_owner` membership after the invited user accepts; store the pending tenant id in server-controlled app metadata, not editable user metadata.

- [ ] **Step 5: Implement and enforce tenant resolution**

Keep the pure `resolveTenantContext` function testable. The server wrapper reads `gt_active_tenant`, queries memberships through the user-scoped Supabase client, and records a sanitized `cross_tenant_access_denied` security event when a supplied tenant id is not allowed. An active audited support session returns the `platform_admin` variant; `requireClientOwnerContext` rejects that variant so support access is read-only. Every private server function added later must call one of these authorization functions before its first data query.

The `_app.tsx` route uses `beforeLoad` only to redirect missing sessions or tenant selection:

```ts
export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = await getRouteSession();
    if (!session.authenticated) throw redirect({ to: "/login" });
    if (!session.tenantSelected) throw redirect({ to: "/select-tenant" });
    return session;
  },
  component: AuthenticatedLayout,
});
```

- [ ] **Step 6: Verify auth behavior and private boundaries**

Run: `cd growth-os && bunx vitest run src/features/auth src/features/tenants && bun run typecheck && bun run build`

Expected: all auth tests PASS; no service-role key is present in the client build; typecheck and build PASS.

- [ ] **Step 7: Commit authentication**

```bash
git add growth-os/src/lib/server/supabase.server.ts growth-os/src/features/auth growth-os/src/features/tenants growth-os/src/routes
git commit -m "feat: add tenant-aware Growth OS authentication"
```

### Task 4: Add Tenant Branding, Audit Events, And Support Sessions

**Files:**
- Create: `growth-os/src/features/audit/audit.server.ts`
- Create: `growth-os/src/features/audit/audit.server.test.ts`
- Create: `growth-os/src/features/branding/brand.schemas.ts`
- Create: `growth-os/src/features/branding/brand.functions.ts`
- Create: `growth-os/src/features/branding/brand.server.test.ts`
- Create: `growth-os/src/features/tenants/support.functions.ts`
- Create: `growth-os/src/features/tenants/support.server.test.ts`
- Create: `growth-os/src/routes/_app.settings.tsx`
- Create: `growth-os/src/routes/admin.support.tsx`

**Interfaces:**
- Produces: `writeAuditEvent(input: AuditInput): Promise<string>`.
- Produces: `getBrand()` and `updateBrand(input: BrandInput)` server functions.
- Produces: `startSupportSession(input: { tenantId: string; reason: string; durationMinutes: number })` and `endSupportSession()`.
- Produces: CSS custom properties `--brand-primary`, `--brand-accent`, and `--brand-on-primary` set from validated tenant branding.

- [ ] **Step 1: Write failing authorization and audit tests**

Create tests that prove a client owner can update only its tenant brand, a non-admin cannot start a support session, a platform admin must provide a reason, the duration cannot exceed 60 minutes, and an audit payload rejects secrets or free-text lead notes:

```ts
it("rejects sensitive audit metadata", () => {
  expect(() =>
    auditMetadataSchema.parse({ access_token: "secret", lead_notes: "private" }),
  ).toThrow();
});

it("normalizes brand colors to six-digit hex", () => {
  expect(brandInputSchema.parse({
    displayName: "Pilot Adjusters",
    logoUrl: "https://cdn.example.com/pilot.svg",
    primaryColor: "#0057B8",
    accentColor: "#F4B400",
    reportName: "Pilot Growth Report",
  }).primaryColor).toBe("#0057b8");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd growth-os && bunx vitest run src/features/audit src/features/branding src/features/tenants/support.server.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement immutable, sanitized audit writes**

Use one fixed action union containing `auth.login`, `auth.logout`, `membership.invited`, `membership.changed`, `brand.updated`, `support.started`, `support.ended`, `cross_tenant_access_denied`, `lead.created`, `lead.status_changed`, `lead.reopened`, `revenue.recorded`, `attribution.recomputed`, `attribution.corrected`, `connector.authorized`, `connector.synced`, `connector.refresh_failed`, `connector.revoked`, `privacy.requested`, `privacy.exported`, `privacy.restricted`, `privacy.deleted`, and `retention.completed`. Metadata may contain only scalar IDs, status values, dates, counts, and sanitized error codes. Call the SQL `write_audit_event` function so the business mutation and audit row share one database transaction whenever possible.

```ts
export type AuditInput = {
  tenantId: string;
  actorId: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string | null;
  requestId: string;
  metadata: Record<string, string | number | boolean | null>;
};
```

- [ ] **Step 4: Implement brand settings and contrast validation**

Validate logo URLs as HTTPS and colors as six-digit hex. Add a pure WCAG contrast helper and reject `primaryColor`/`onPrimaryColor` pairs below 4.5:1. The settings page uses actual color swatches and inputs, not text-only color names. On load, set brand variables on the authenticated layout element; do not overwrite global public-site styles.

```ts
export const brandInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  logoUrl: z.string().url().refine((url) => url.startsWith("https://")),
  primaryColor: hexColor,
  accentColor: hexColor,
  onPrimaryColor: hexColor,
  reportName: z.string().trim().min(1).max(120),
});
```

- [ ] **Step 5: Implement explicit support sessions**

`startSupportSession` verifies the current user is listed in `platform_admins`, validates the reason, calls the database function, sets `gt_active_tenant` and `gt_support_session` as secure HTTP-only cookies, and returns the exact expiry. `endSupportSession` revokes the row, writes `support.ended`, and clears both cookies. Ordinary tenant selection must never create a support session.

- [ ] **Step 6: Verify branding and support access**

Run: `cd growth-os && bunx vitest run src/features/audit src/features/branding src/features/tenants && bun run test:db && bun run typecheck`

Expected: unit and pgTAP tests PASS; invalid contrast and unaudited support access are rejected.

- [ ] **Step 7: Commit branding and audit controls**

```bash
git add growth-os/src/features/audit growth-os/src/features/branding growth-os/src/features/tenants growth-os/src/routes/_app.settings.tsx growth-os/src/routes/admin.support.tsx
git commit -m "feat: add branded tenants and audited support access"
```

### Task 5: Build Signed Website Lead Ingestion Without Weakening Consent

**Files:**
- Create: `growth-os/src/lib/server/crypto.server.ts`
- Create: `growth-os/src/lib/server/crypto.server.test.ts`
- Create: `growth-os/src/features/intake/signature.server.ts`
- Create: `growth-os/src/features/intake/signature.server.test.ts`
- Create: `growth-os/src/features/intake/ingest.server.ts`
- Create: `growth-os/src/features/intake/ingest.server.test.ts`
- Create: `growth-os/src/routes/api.ingest.v1.leads.ts`
- Create: `src/lib/growth-os-ingest.ts`
- Create: `tests/growth-os-handoff.test.mjs`
- Modify: `src/lib/intake-schema.ts`
- Modify: `src/lib/intake.ts`
- Modify: `src/components/sections/contact.tsx`
- Modify: `.env.example`

**Interfaces:**
- Produces: `encryptField(plaintext: string, purpose: "lead" | "connector"): string` and `decryptField(envelope: string, purpose: ...): string`.
- Produces: `lookupHash(value: string, purpose: "email" | "phone"): string`.
- Produces: `verifyIngestSignature(input: VerifySignatureInput): void`.
- Produces: `ingestLead(siteKeyId: string, event: LeadEventV1): Promise<LeadEventAck>`.
- Produces: website helper `deliverLeadToGrowthOs(event: LeadEventV1): Promise<"accepted" | "duplicate" | "unconfigured">`.
- Consumes: `X-GT-Key-Id`, `X-GT-Timestamp`, `X-GT-Idempotency-Key`, and `X-GT-Signature` request headers.

- [ ] **Step 1: Write failing encryption, signature, and handoff tests**

Create tests that use fixed keys and clocks. Required cases are encryption round trip, purpose separation, tamper rejection, timestamp skew beyond 300 seconds, wrong HMAC, body above 32 KiB, duplicate idempotency key, unknown site key, marketing consent false, GPC true, prohibited property rejection, and website success when Growth OS fails but email succeeds.

```ts
it("rejects a replay outside the five-minute window", () => {
  expect(() => verifyIngestSignature({
    body: "{}",
    timestamp: "2026-08-09T15:50:00.000Z",
    idempotencyKey: "7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4",
    presentedSignature: "sha256=deadbeef",
    secret: "test-signing-secret-with-32-bytes-minimum",
    now: new Date("2026-08-09T16:00:00.000Z"),
  })).toThrowErrorMatchingObject({ code: "SIGNATURE_EXPIRED" });
});
```

Add `tests/growth-os-handoff.test.mjs` as a static regression check that the public contact form still contains the privacy acknowledgment, passes the four consent categories plus GPC, keeps `trackLeadEvent` consent-gated, and never sends personal values to that function.

- [ ] **Step 2: Run the intake tests to verify they fail**

Run: `cd growth-os && bunx vitest run src/lib/server/crypto.server.test.ts src/features/intake && cd .. && node tests/growth-os-handoff.test.mjs`

Expected: FAIL because the encryption, signature, ingestion, and public-site handoff do not exist.

- [ ] **Step 3: Implement versioned encryption and lookup hashes**

Use AES-256-GCM with a fresh 12-byte IV and a versioned envelope `v1.<base64url-iv>.<base64url-ciphertext-and-tag>`. Derive purpose-specific keys from a 32-byte base64 environment key with HKDF-SHA-256. Use a separate HMAC key for normalized email and phone lookup values. Never log plaintext, keys, ciphertext, or provider responses.

```ts
export type CryptoPurpose = "lead" | "connector";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string) {
  return value.replace(/[^0-9+]/g, "");
}
```

Read `FIELD_ENCRYPTION_KEY_V1` and `LOOKUP_HMAC_KEY_V1` only when a server function calls the helpers. Keep key version `v1` in each envelope so a later rotation can decrypt old records and write new records with `v2`.

- [ ] **Step 4: Implement HMAC verification and replay protection**

Sign this exact UTF-8 message with HMAC-SHA-256:

```text
<timestamp>\n<idempotency-key>\n<raw-request-body>
```

```ts
export type VerifySignatureInput = {
  body: string;
  timestamp: string;
  idempotencyKey: string;
  presentedSignature: string;
  secret: string;
  now: Date;
};
```

Compare signatures with `timingSafeEqual`. Reject missing headers, timestamps more than 300 seconds from server time, bodies over 32,768 bytes, invalid UUID idempotency keys, disabled sites, and signatures that do not match the encrypted site secret. Rate-limit by `site_id` to 120 attempts per rolling minute; do not key the limiter by IP and do not persist request IPs.

- [ ] **Step 5: Persist one lead and consent receipt atomically**

The ingestion transaction must:

1. Reserve `(tenant_id, site_id, idempotency_key)` in `ingest_idempotency`.
2. Return the existing lead id with `status: "duplicate"` on a retry.
3. Encrypt contact fields and create one `leads` row.
4. Store attribution evidence without contact fields.
5. Store the complete `consent_receipts` row even when analytics and marketing are false.
6. Run deterministic attribution from Task 7 only after that module exists; until then store evidence with `touch_type = 'unresolved'`.
7. Write `lead.created` with only tenant, site, lead id, and request id.

The server route reads raw text before JSON parsing so the signature covers the received bytes. It returns 202 for accepted, 200 for duplicate, 400 for schema failure, 401 for signature failure, 409 for a conflicting reused key, 413 for an oversized body, and 429 for the site rate limit. All errors use `{ code, request_id }` without echoing request fields.

- [ ] **Step 6: Add the public website's server-only signer**

`src/lib/growth-os-ingest.ts` builds the versioned contract from the validated contact form, stores the landing origin plus pathname without query or fragment, derives the referrer domain with `new URL(referrer).hostname`, drops the full referrer URL, and signs the request using Node Web Crypto. When marketing consent is false or GPC is true, set `click_ids` to an empty object; declared source and sanitized UTM fields remain first-party form context and no provider event is emitted. Read `GROWTH_OS_INGEST_URL`, `GROWTH_OS_SITE_KEY_ID`, and `GROWTH_OS_SITE_SIGNING_SECRET` inside `deliverLeadToGrowthOs`. Return `unconfigured` when any value is absent.

Extend the public form payload with this exact receipt:

```ts
consent_receipt: {
  policy_version: "privacy-2026-08-08",
  source: "contact-form",
  necessary: true,
  analytics: consent.state.analytics,
  marketing: consent.state.marketing && !consent.gpc,
  preferences: consent.state.preferences,
  contact_requested: true,
  gpc: consent.gpc,
  recorded_at: new Date().toISOString(),
}
```

`src/lib/intake.ts` attempts email and Growth OS independently. Return `sent` when either destination accepts the lead; preserve the current mail-client fallback only when both are unavailable or fail. Log only status codes and a request id.

- [ ] **Step 7: Verify consent, resilience, and schema safety**

Run: `cd growth-os && bunx vitest run src/lib/server/crypto.server.test.ts src/features/intake && bun run test:db && cd .. && node tests/growth-os-handoff.test.mjs && bun run lint && bun run build`

Expected: all tests PASS; the public website builds; a lead with analytics and marketing denied is accepted; no prohibited tracking field exists in the persisted schema.

- [ ] **Step 8: Commit signed intake**

```bash
git add .env.example src/lib/intake-schema.ts src/lib/intake.ts src/lib/growth-os-ingest.ts src/components/sections/contact.tsx tests/growth-os-handoff.test.mjs growth-os/src/lib/server growth-os/src/features/intake growth-os/src/routes/api.ingest.v1.leads.ts
git commit -m "feat: ingest consent-safe website leads"
```

### Task 6: Build The Encrypted Lead And Confirmed-Revenue Ledger

**Files:**
- Create: `growth-os/src/features/leads/lead.schemas.ts`
- Create: `growth-os/src/features/leads/lead-state.ts`
- Create: `growth-os/src/features/leads/lead-state.test.ts`
- Create: `growth-os/src/features/leads/leads.server.ts`
- Create: `growth-os/src/features/leads/leads.functions.ts`
- Create: `growth-os/src/features/leads/leads.server.test.ts`
- Create: `growth-os/src/features/leads/lead-list.tsx`
- Create: `growth-os/src/features/leads/lead-detail.tsx`
- Create: `growth-os/src/routes/_app.leads.tsx`
- Create: `growth-os/src/routes/_app.leads.$leadId.tsx`

**Interfaces:**
- Produces: `LeadStatus = "new" | "qualified" | "booked" | "won" | "lost"`.
- Produces: `canTransitionLead(from: LeadStatus, to: LeadStatus): boolean`.
- Produces: `listLeads(input: LeadListInput): Promise<LeadListPage>` and `getLead(input: { leadId: string }): Promise<LeadDetail>`.
- Produces: `changeLeadStatus(input: StatusChangeInput)` and `recordRevenue(input: RevenueInput)` server functions.
- Produces: `RevenueInput = { leadId: string; amountMinor: string; currency: string; confirmedAt: string; note?: string }` where `amountMinor` serializes a positive bigint as decimal digits.

- [ ] **Step 1: Write failing state and revenue tests**

Create `lead-state.test.ts` with the complete transition matrix:

```ts
const allowed: Record<LeadStatus, LeadStatus[]> = {
  new: ["qualified", "lost"],
  qualified: ["booked", "won", "lost"],
  booked: ["won", "lost"],
  won: [],
  lost: [],
};

for (const from of Object.keys(allowed) as LeadStatus[]) {
  for (const to of ["new", "qualified", "booked", "won", "lost"] as LeadStatus[]) {
    it(`${from} -> ${to}`, () => {
      expect(canTransitionLead(from, to)).toBe(allowed[from].includes(to));
    });
  }
}
```

Add server tests proving: a wrong-tenant lead returns not found; list responses contain decrypted display fields but never ciphertext/hash columns; a `won` transition may occur without revenue; revenue can be attached only to a `won` lead; revenue rejects zero, negative values, more than two decimals after conversion, invalid ISO 4217 codes, and future confirmation dates; reopen of `won` or `lost` is a separate owner action requiring a 10-500 character reason and audit event.

- [ ] **Step 2: Run the lead tests to verify they fail**

Run: `cd growth-os && bunx vitest run src/features/leads`

Expected: FAIL because the lead ledger modules do not exist.

- [ ] **Step 3: Implement schemas and the state machine**

Use a literal transition set and never infer transitions from display order:

```ts
const transitions = new Set([
  "new:qualified",
  "new:lost",
  "qualified:booked",
  "qualified:won",
  "qualified:lost",
  "booked:won",
  "booked:lost",
]);

export function canTransitionLead(from: LeadStatus, to: LeadStatus) {
  return transitions.has(`${from}:${to}`);
}
```

Validate list filters for status, declared source, created date, and an exact email lookup hash. Cap page size at 100. Search never decrypts all tenant leads; exact email/phone search uses the HMAC lookup columns.

Define the mutation and paging contracts in `lead.schemas.ts`:

```ts
export type LeadListInput = {
  status?: LeadStatus;
  source?: string;
  from?: string;
  to?: string;
  exactEmail?: string;
  cursor?: string;
  limit: number;
};

export type LeadListPage = {
  items: Array<{
    id: string;
    name: string;
    email: string;
    company: string | null;
    status: LeadStatus;
    declaredSource: string;
    confidence: "high" | "medium" | "low";
    confirmedRevenueMinor: string | null;
    occurredAt: string;
    lastActivityAt: string;
  }>;
  nextCursor: string | null;
};

export type LeadDetail = LeadListPage["items"][number] & {
  phone: string | null;
  notes: string;
  budgetRange: string;
  timelineRange: string;
  firstTouch: { source: string | null; confidence: "high" | "medium" | "low"; state: "attributed" | "ambiguous" | "unattributed" } | null;
  lastTouch: { source: string | null; confidence: "high" | "medium" | "low"; state: "attributed" | "ambiguous" | "unattributed" } | null;
  consent: ConsentReceiptV1;
};

export type StatusChangeInput = {
  leadId: string;
  to: LeadStatus;
};

export class LeadNotFoundError extends Error {
  readonly code = "LEAD_NOT_FOUND";
}
```

- [ ] **Step 4: Implement server-only lead queries and mutations**

Every read begins with `requireTenantContext()` and every mutation begins with `requireClientOwnerContext()`. Include `tenant_id` and `restricted_at is null` in every query even though RLS also applies. Decrypt only the rows returned for the current page. A cross-tenant UUID must return the same not-found result as an unknown UUID.

Use one database RPC for each status or revenue mutation so the lead, optional outcome, last-activity timestamp, and audit event commit together. Marking a lead `won` does not invent or require revenue; `recordRevenue` rejects any lead whose current status is not `won`:

```ts
export const changeLeadStatus = createServerFn({ method: "POST" })
  .validator(statusChangeSchema)
  .handler(async ({ data }) => {
    const context = await requireClientOwnerContext();
    const result = await updateLeadStatusTransaction(context, data);
    if (!result) throw new LeadNotFoundError();
    return result;
  });
```

Store optional internal revenue notes with lead-purpose encryption. Never copy them to `audit_events`, analytics, connector payloads, or logs.

- [ ] **Step 5: Build the lead list and detail workflow**

The lead list is a dense table with status, received date, declared source, attribution confidence, last activity, and confirmed revenue. The detail view uses a segmented status control, a revenue form shown for `won`, attribution evidence, and a chronological audit list. Use icons for search, filter, and refresh controls with tooltips; do not wrap page sections in cards or place cards inside cards.

The client sends only UUIDs and validated mutation input. It does not receive encrypted columns, hashes, raw consent metadata, or audit metadata unrelated to that lead.

- [ ] **Step 6: Verify lead lifecycle behavior**

Run: `cd growth-os && bunx vitest run src/features/leads && bun run test:db && bun run typecheck && bun run build`

Expected: all transition, tenant, encryption-surface, revenue, and audit tests PASS; build PASS.

- [ ] **Step 7: Commit the lead ledger**

```bash
git add growth-os/src/features/leads growth-os/src/routes/_app.leads.tsx 'growth-os/src/routes/_app.leads.$leadId.tsx' growth-os/supabase/migrations
git commit -m "feat: add lead and confirmed revenue ledger"
```

### Task 7: Implement Deterministic Attribution And ROI Calculations

**Files:**
- Create: `growth-os/src/features/attribution/attribution.types.ts`
- Create: `growth-os/src/features/attribution/attribution.ts`
- Create: `growth-os/src/features/attribution/attribution.test.ts`
- Create: `growth-os/src/features/attribution/attribution.server.ts`
- Create: `growth-os/src/features/attribution/attribution.functions.ts`
- Create: `growth-os/src/features/attribution/attribution.server.test.ts`
- Create: `growth-os/src/features/metrics/calculations.ts`
- Create: `growth-os/src/features/metrics/calculations.test.ts`
- Create: `growth-os/src/features/metrics/overview.server.ts`
- Create: `growth-os/src/features/metrics/overview.server.test.ts`

**Interfaces:**
- Produces: `resolveAttribution(evidence: AttributionEvidence): AttributionDecision`.
- Produces: `AttributionDecision = { source: string | null; campaignExternalId: string | null; confidence: "high" | "medium" | "low"; state: "attributed" | "ambiguous" | "unattributed"; reasonCodes: AttributionReason[] }`.
- Produces: `recomputeLeadAttribution(tenantId: string, leadId: string): Promise<void>`.
- Produces: `calculateOverview(input: OverviewFacts): OverviewMetrics`.
- Produces: `getOverview(input: DateRangeInput): Promise<OverviewViewModel>`.

- [ ] **Step 1: Write the failing attribution table tests**

Use table-driven fixtures covering every precedence and conflict:

```ts
it.each([
  [
    "declared beats click id",
    { declaredSource: "referral", clickIds: { gclid: "g-1" }, utmSource: "google" },
    { source: "referral", confidence: "high", state: "attributed" },
  ],
  [
    "click id beats utm",
    { declaredSource: null, clickIds: { gclid: "g-1" }, utmSource: "newsletter" },
    { source: "google_ads", confidence: "high", state: "attributed" },
  ],
  [
    "utm beats referrer",
    { declaredSource: null, clickIds: {}, utmSource: "meta", referrerDomain: "google.com" },
    { source: "meta_ads", confidence: "medium", state: "attributed" },
  ],
  [
    "referrer is low confidence",
    { declaredSource: null, clickIds: {}, utmSource: null, referrerDomain: "google.com" },
    { source: "google_organic", confidence: "low", state: "attributed" },
  ],
  [
    "missing evidence stays unattributed",
    { declaredSource: null, clickIds: {}, utmSource: null, referrerDomain: null },
    { source: null, confidence: "low", state: "unattributed" },
  ],
])("%s", (_name, evidence, expected) => {
  expect(resolveAttribution(evidence)).toMatchObject(expected);
});
```

Add conflict tests where two valid click IDs identify different providers and where declared source conflicts with a click ID. Declared source retains precedence but the decision state is `ambiguous`, confidence drops one level, and both reason codes remain visible.

- [ ] **Step 2: Write the failing calculation tests**

Use integer facts and exact expected values:

```ts
expect(calculateOverview({
  totalLeads: 20,
  qualifiedLeads: 8,
  wonLeads: 4,
  paidQualifiedLeads: 5,
  spendMinor: 100_000n,
  paidRevenueMinor: 300_000n,
  attributedRevenueMinor: 360_000n,
})).toEqual({
  qualifiedLeadRate: 0.4,
  closeRate: 0.5,
  costPerQualifiedLeadMinor: 20_000n,
  roas: 3,
  marketingRoi: 2.6,
});

expect(calculateOverview({
  totalLeads: 0,
  qualifiedLeads: 0,
  wonLeads: 0,
  paidQualifiedLeads: 0,
  spendMinor: 0n,
  paidRevenueMinor: 0n,
  attributedRevenueMinor: 0n,
})).toEqual({
  qualifiedLeadRate: null,
  closeRate: null,
  costPerQualifiedLeadMinor: null,
  roas: null,
  marketingRoi: null,
});
```

- [ ] **Step 3: Run the attribution and metric tests to verify they fail**

Run: `cd growth-os && bunx vitest run src/features/attribution src/features/metrics`

Expected: FAIL because attribution and calculation modules do not exist.

- [ ] **Step 4: Implement the pure attribution decision engine**

Normalize declared source and UTM values through a fixed map (`google`/`google ads` -> `google_ads`, `facebook`/`instagram`/`meta` -> `meta_ads`, `referral`, `organic`, `direct`, `other`). Recognize click IDs only by key; never attempt to resolve or enrich a person. Assign base confidence: declared and valid click reference `high`, UTM `medium`, referrer and direct/unknown `low`. Keep all evidence strings sanitized and capped at 200 characters.

First touch uses the earliest accepted evidence timestamp; last touch uses the latest evidence timestamp at or before the lead submission. Recomputing produces the same two touches for the same evidence. When the visible result changes, write `attribution.recomputed` with old/new source, confidence, state, and reason codes, never contact fields.

- [ ] **Step 5: Implement manual correction as a separate overlay**

Do not overwrite source evidence. Store a manual `attribution_touches` row with `is_manual = true`, actor id, 10-500 character reason, and original computed touch id. Display both the correction and original result. Audit with `attribution.corrected`.

- [ ] **Step 6: Implement exact ROI semantics**

Use only `campaign_metrics_daily.is_complete = true` rows inside the selected tenant timezone/date range. Use only human-confirmed `revenue_outcomes`. `paidRevenueMinor` includes won leads whose selected first/last attribution source is a paid provider. `attributedRevenueMinor` includes all won leads with non-null attribution. Return amounts as decimal strings from server functions so bigint crosses the RPC boundary without precision loss.

The overview response includes:

```ts
export type DateRangeInput = {
  from: string;
  to: string;
  model: "first_touch" | "last_touch";
};

export type OverviewViewModel = {
  range: { start: string; end: string; timezone: string };
  currency: string;
  freshness: { provider: Provider; lastSuccessfulSync: string | null; state: "fresh" | "stale" | "missing" }[];
  totals: {
    confirmedRevenueMinor: string;
    spendMinor: string | null;
    qualifiedLeads: number;
    wonLeads: number;
    unattributedLeads: number;
    ambiguousLeads: number;
  };
  ratios: {
    qualifiedLeadRate: number | null;
    closeRate: number | null;
    costPerQualifiedLeadMinor: string | null;
    roas: number | null;
    marketingRoi: number | null;
  };
};
```

- [ ] **Step 7: Verify deterministic results and tenant-safe queries**

Run: `cd growth-os && bunx vitest run src/features/attribution src/features/metrics && bun run test:db && bun run typecheck`

Expected: precedence, ambiguity, manual correction, idempotency, complete-window, zero-denominator, and cross-tenant tests PASS.

- [ ] **Step 8: Commit attribution and ROI**

```bash
git add growth-os/src/features/attribution growth-os/src/features/metrics growth-os/supabase/migrations
git commit -m "feat: calculate evidence-based attribution and ROI"
```

### Task 8: Create The Read-Only Connector Contract And Sync Orchestrator

**Files:**
- Create: `growth-os/src/features/connectors/core/connector.types.ts`
- Create: `growth-os/src/features/connectors/core/connector.ts`
- Create: `growth-os/src/features/connectors/core/connector.contract.test.ts`
- Create: `growth-os/src/features/connectors/core/oauth-state.server.ts`
- Create: `growth-os/src/features/connectors/core/oauth-state.server.test.ts`
- Create: `growth-os/src/features/connectors/core/credentials.server.ts`
- Create: `growth-os/src/features/connectors/core/sync.server.ts`
- Create: `growth-os/src/features/connectors/core/sync.server.test.ts`
- Create: `growth-os/src/features/connectors/core/registry.server.ts`
- Create: `growth-os/src/features/connectors/core/connection.functions.ts`
- Create: `growth-os/src/routes/api.oauth.$provider.callback.ts`
- Create: `growth-os/src/routes/api.jobs.sync.ts`

**Interfaces:**
- Consumes: canonical `Provider` from `growth-os/src/lib/domain.ts`.
- Produces: `NormalizedMetricRow`, `ConnectorAccount`, `ConnectionCredential`, and `ConnectorError`.
- Produces: `Connector` interface and `getConnector(provider: Provider): Connector`.
- Produces: `runConnectionSync(input: SyncRequest): Promise<SyncResult>`.
- Produces: server functions `beginConnection`, `selectProviderAccount`, `revokeConnection`, and `retryConnection`.

- [ ] **Step 1: Write the failing connector contract tests**

Define one reusable test suite that every provider fixture adapter must pass:

```ts
export type OAuthStart = {
  tenantId: string;
  userId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string | null;
};

export type OAuthCallback = {
  code: string;
  redirectUri: string;
  codeVerifier: string | null;
};

export type ConnectionCredential = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  grantedScopes: string[];
  providerMetadata: Record<string, string>;
};

export type ConnectorAccount = {
  externalId: string;
  displayName: string;
  currency: string;
  timezone: string;
};

export type ImportWindow = {
  credential: ConnectionCredential;
  account: ConnectorAccount;
  start: string;
  end: string;
  checkpoint: string | null;
};

export type ImportResult = {
  rows: NormalizedMetricRow[];
  checkpoint: string;
  sourceUpdatedAt: string | null;
  complete: boolean;
  unknownFieldCount: number;
};

export interface Connector {
  readonly provider: Provider;
  readonly requiredScopes: readonly string[];
  createAuthorizationUrl(input: OAuthStart): Promise<URL>;
  exchangeAuthorizationCode(input: OAuthCallback): Promise<ConnectionCredential>;
  refreshCredential(input: ConnectionCredential): Promise<ConnectionCredential>;
  listAccounts(input: ConnectionCredential): Promise<ConnectorAccount[]>;
  importWindow(input: ImportWindow): Promise<ImportResult>;
  revoke(input: ConnectionCredential): Promise<void>;
}

export type NormalizedMetricRow = {
  externalCampaignId: string;
  campaignName: string;
  campaignStatus: "active" | "paused" | "removed" | "unknown";
  metricDate: string;
  timezone: string;
  currency: string;
  impressions: number | null;
  clicks: number | null;
  sessions: number | null;
  engagedSessions: number | null;
  users: number | null;
  spendMinor: bigint | null;
  providerConversions: string | null;
  providerConversionValueMinor: bigint | null;
  sourceUpdatedAt: string | null;
};

export type SyncRequest = {
  connectionId: string;
  requestedBy: "scheduler" | "owner";
  now: string;
};

export class ConnectorError extends Error {
  constructor(
    readonly code: "RATE_LIMITED" | "NETWORK" | "TOKEN_EXPIRED" | "TOKEN_REVOKED" | "INVALID_RESPONSE" | "INVALID_SCOPE",
    readonly retryable: boolean,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
  }
}
```

Contract cases: successful response, empty response, pagination, late adjustment upsert, 429 with retry hint, expired token refresh, revoked token, interrupted checkpoint restart, currency mismatch rejection, invalid date rejection, and stable output with unknown provider fields.

- [ ] **Step 2: Run the core connector tests to verify they fail**

Run: `cd growth-os && bunx vitest run src/features/connectors/core`

Expected: FAIL because the connector contract and sync engine do not exist.

- [ ] **Step 3: Implement signed OAuth state and encrypted credentials**

OAuth state contains `{ provider, tenantId, userId, nonce, returnPath, expiresAt }`, is HMAC-signed with `OAUTH_STATE_SECRET`, expires in 10 minutes, and is matched to a secure HTTP-only nonce cookie. Use PKCE where the provider supports it. `returnPath` must be one of `/connections` or `/settings`; do not accept arbitrary redirects.

Store access token, refresh token, expiry, and provider token metadata as one connector-purpose encrypted JSON envelope. Return only provider, selected account, granted scope names, expiry, and health to the browser. OAuth errors and logs contain provider error codes but no token, authorization code, request body, or provider payload.

- [ ] **Step 4: Implement the sync state machine**

Use these connection states: `pending`, `healthy`, `syncing`, `stale`, `action_required`, and `revoked`. Create `sync_runs` before import. A first import is limited to the previous 30 complete days; incremental runs begin two days before the checkpoint to capture late provider adjustments and end at yesterday in the tenant timezone. Split work into windows no larger than 31 days.

```ts
export type SyncResult = {
  syncRunId: string;
  status: "succeeded" | "retry_scheduled" | "action_required" | "failed";
  importedRows: number;
  checkpoint: string | null;
  nextAttemptAt: string | null;
};
```

Map 401/invalid-grant to `action_required`. Map 429 and retryable 5xx/network failures to attempts after 1, 4, then 16 minutes with at most three retries per run. Sanitize all other errors to a fixed code. Keep the last successful metrics untouched when a run fails.

- [ ] **Step 5: Publish only a complete normalized window**

Validate every normalized row before publication: dates fall inside the requested window, campaign ids are non-empty, currency is a three-letter uppercase code, counts are nonnegative safe integers, money is bigint, and all rows match the selected account timezone/currency. Upsert campaigns first, replace only the affected connection/date window inside `publish_metric_window`, mark rows complete, advance the checkpoint, create one `provider_import` consent receipt tied to the connection and sync run with `processing_basis = 'account_authorization'`, and audit the visible adjustment count in one transaction. The receipt records granted read-only scopes, authorizing owner id, connection authorization timestamp, provider, and policy version; it contains no provider row payload or token. Invalid or partial rows remain outside published metric tables and receive no accepted-import receipt.

- [ ] **Step 6: Add authenticated scheduler and revoke behavior**

`POST /api/jobs/sync` requires `Authorization: Bearer <SYNC_JOB_SECRET>`, accepts an optional provider/connection filter only in non-production test mode, and selects due connections in batches of 10 with database locking so two schedulers cannot sync the same connection. `revokeConnection` calls the provider's revoke method, deletes the credential envelope, marks the connection revoked, preserves historical metrics, and writes `connector.revoked`.

- [ ] **Step 7: Verify core failure behavior**

Run: `cd growth-os && bunx vitest run src/features/connectors/core && bun run test:db && bun run typecheck`

Expected: connector contract and sync tests PASS; incomplete windows never replace published rows; revoked credentials are not recoverable from browser responses or logs.

- [ ] **Step 8: Commit connector infrastructure**

```bash
git add growth-os/src/features/connectors/core 'growth-os/src/routes/api.oauth.$provider.callback.ts' growth-os/src/routes/api.jobs.sync.ts growth-os/supabase/migrations
git commit -m "feat: add read-only connector sync engine"
```

### Task 9: Implement Google Analytics 4 And Google Ads Connectors

**Files:**
- Create: `growth-os/src/features/connectors/google/google-oauth.server.ts`
- Create: `growth-os/src/features/connectors/google-analytics/google-analytics.connector.ts`
- Create: `growth-os/src/features/connectors/google-analytics/google-analytics.connector.test.ts`
- Create: `growth-os/src/features/connectors/google-analytics/fixtures/run-report-success.json`
- Create: `growth-os/src/features/connectors/google-analytics/fixtures/run-report-empty.json`
- Create: `growth-os/src/features/connectors/google-analytics/fixtures/run-report-adjusted.json`
- Create: `growth-os/src/features/connectors/google-ads/google-ads.connector.ts`
- Create: `growth-os/src/features/connectors/google-ads/google-ads.connector.test.ts`
- Create: `growth-os/src/features/connectors/google-ads/fixtures/search-success.json`
- Create: `growth-os/src/features/connectors/google-ads/fixtures/search-page-2.json`
- Create: `growth-os/src/features/connectors/google-ads/fixtures/search-rate-limit.json`
- Modify: `growth-os/src/features/connectors/core/registry.server.ts`
- Modify: `growth-os/.env.example`

**Interfaces:**
- Produces: registered connectors `google_analytics` and `google_ads`.
- Consumes: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, and `GOOGLE_ADS_API_VERSION`.
- Consumes: GA4 scope `https://www.googleapis.com/auth/analytics.readonly` and Google Ads scope `https://www.googleapis.com/auth/adwords` in separate authorization requests.

- [ ] **Step 1: Create de-identified provider fixtures and failing tests**

GA4 fixtures contain `date`, `sessionSource`, `sessionMedium`, and `sessionCampaignName` dimensions plus `sessions`, `engagedSessions`, `activeUsers`, and `keyEvents` metrics. Google Ads fixtures contain `campaign.id`, `campaign.name`, `campaign.status`, `segments.date`, `customer.currencyCode`, `customer.timeZone`, `metrics.impressions`, `metrics.clicks`, `metrics.costMicros`, `metrics.conversions`, and `metrics.conversionsValue`.

Assert that `$1.23` represented as `1_230_000` cost micros becomes `123n` minor units, GA4 spend remains `null`, an empty response returns an empty complete window, pagination preserves rows exactly once, and a late adjustment changes only the affected day.

- [ ] **Step 2: Run Google connector tests to verify they fail**

Run: `cd growth-os && bunx vitest run src/features/connectors/google-analytics src/features/connectors/google-ads`

Expected: FAIL because the Google connectors do not exist.

- [ ] **Step 3: Implement shared Google OAuth without scope overreach**

Use the Google web-server OAuth flow with offline access and consent prompting only when a refresh token is absent. GA4 and Google Ads are separate connection records and request only their provider's scope. Validate the returned granted scopes before saving credentials. The callback lists available GA4 properties or Google Ads customer accounts, then requires the owner to choose one before the first sync.

- [ ] **Step 4: Implement the GA4 bounded report import**

POST to `https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport` with one bounded date range. Request campaign acquisition dimensions and metrics. Use the response header order, not assumed array positions, to map dimension and metric values. Normalize each source/medium/campaign tuple to a stable external campaign id produced by SHA-256 of those three values. Use the GA4 property's timezone and currency selected during connection setup.

Do not request user-level, device-level, city, latitude, longitude, advertising id, or demographic dimensions.

- [ ] **Step 5: Implement the Google Ads GAQL import**

Read `GOOGLE_ADS_API_VERSION` from server environment so an API upgrade is a configuration and fixture-review change. POST to:

```text
https://googleads.googleapis.com/<version>/customers/<customer-id>/googleAds:search
```

Send bearer auth, `developer-token`, and `login-customer-id` only when the selected account requires a manager account. Use this fixed read-only query with validated date literals:

```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  segments.date,
  customer.currency_code,
  customer.time_zone,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM campaign
WHERE segments.date BETWEEN '2026-08-01' AND '2026-08-08'
ORDER BY segments.date, campaign.id
```

Construct the two date literals from the validated sync window, follow `nextPageToken`, and convert micros to minor units with integer arithmetic using the currency exponent. Reject a value that cannot be represented exactly in the configured currency.

- [ ] **Step 6: Run Google contract and integration tests**

Run: `cd growth-os && bunx vitest run src/features/connectors/core src/features/connectors/google-analytics src/features/connectors/google-ads && bun run typecheck`

Expected: both providers pass the shared connector contract; OAuth scope validation, pagination, currency conversion, refresh, revocation, and rate-limit cases PASS.

- [ ] **Step 7: Commit Google connectors**

```bash
git add growth-os/src/features/connectors/google growth-os/src/features/connectors/google-analytics growth-os/src/features/connectors/google-ads growth-os/src/features/connectors/core/registry.server.ts growth-os/.env.example
git commit -m "feat: connect GA4 and Google Ads reporting"
```

### Task 10: Implement The Meta Ads Connector

**Files:**
- Create: `growth-os/src/features/connectors/meta-ads/meta-ads.connector.ts`
- Create: `growth-os/src/features/connectors/meta-ads/meta-ads.connector.test.ts`
- Create: `growth-os/src/features/connectors/meta-ads/fixtures/accounts-success.json`
- Create: `growth-os/src/features/connectors/meta-ads/fixtures/insights-success.json`
- Create: `growth-os/src/features/connectors/meta-ads/fixtures/insights-page-2.json`
- Create: `growth-os/src/features/connectors/meta-ads/fixtures/insights-empty.json`
- Create: `growth-os/src/features/connectors/meta-ads/fixtures/insights-rate-limit.json`
- Modify: `growth-os/src/features/connectors/core/registry.server.ts`
- Modify: `growth-os/.env.example`

**Interfaces:**
- Produces: registered `meta_ads` connector.
- Consumes: `META_APP_ID`, `META_APP_SECRET`, and a required `META_GRAPH_API_VERSION` matching `^v[0-9]+\.[0-9]+$`.
- Requests: read-only Meta permission `ads_read`; add `business_management` only if a verified pilot account cannot be listed with `ads_read` alone and document that change before requesting App Review.

- [ ] **Step 1: Write failing Meta fixture tests**

Use de-identified fixtures and assert account selection, pagination, currency/timezone preservation, string-to-integer money conversion, action normalization, empty complete windows, 429 handling, expired token handling, and revocation. Normalize provider conversions from only these action types: `lead`, `offsite_conversion.fb_pixel_lead`, and `onsite_conversion.lead_grouped`; ignore unknown action types while preserving a sanitized unknown-action count in the sync run.

```ts
expect(normalizeMetaInsight({
  campaign_id: "9001",
  campaign_name: "Storm response",
  date_start: "2026-08-08",
  date_stop: "2026-08-08",
  impressions: "2000",
  clicks: "75",
  spend: "123.45",
  actions: [
    { action_type: "lead", value: "3" },
    { action_type: "post_reaction", value: "18" },
  ],
}, { currency: "USD", timezone: "America/New_York" })).toMatchObject({
  externalCampaignId: "9001",
  metricDate: "2026-08-08",
  impressions: 2000,
  clicks: 75,
  spendMinor: 12345n,
  providerConversions: "3",
});
```

- [ ] **Step 2: Run Meta tests to verify they fail**

Run: `cd growth-os && bunx vitest run src/features/connectors/meta-ads`

Expected: FAIL because the Meta connector does not exist.

- [ ] **Step 3: Implement read-only Meta authorization and account selection**

Build the authorization URL from the configured Graph API version, `META_APP_ID`, the exact callback URI, signed state, and `ads_read`. Exchange the short-lived user token server-side, then exchange it for a long-lived token when the current Meta flow supports that exchange. Validate the token with Meta's debug endpoint and reject it unless the app id, user id, expiry, and granted scope match the pending connection.

List only ad accounts the user can inspect. Persist selected `act_<id>`, account display name, currency, and timezone; return no access token to the browser.

- [ ] **Step 4: Implement paginated campaign Insights import**

Request this fixed field list from `/{act_account_id}/insights` at campaign level:

```text
campaign_id,campaign_name,impressions,clicks,spend,actions,date_start,date_stop
```

Send `level=campaign`, `time_increment=1`, a validated `time_range`, and `limit=500`. Follow only `paging.next` URLs whose origin is exactly `https://graph.facebook.com` and whose version matches `META_GRAPH_API_VERSION`; stop after 100 pages and mark larger runs failed for operator review. Convert decimal spend to minor units without JavaScript floating-point multiplication.

- [ ] **Step 5: Verify Meta against the common connector contract**

Run: `cd growth-os && bunx vitest run src/features/connectors/core src/features/connectors/meta-ads && bun run typecheck`

Expected: Meta passes the shared successful, empty, paginated, adjusted, rate-limited, refresh, revoke, and checkpoint contract cases.

- [ ] **Step 6: Commit Meta reporting**

```bash
git add growth-os/src/features/connectors/meta-ads growth-os/src/features/connectors/core/registry.server.ts growth-os/.env.example
git commit -m "feat: connect Meta Ads reporting"
```

### Task 11: Build The Decision-Focused Client Dashboard

**Files:**
- Create: `growth-os/src/components/app-shell.tsx`
- Create: `growth-os/src/components/date-range-control.tsx`
- Create: `growth-os/src/components/metric-value.tsx`
- Create: `growth-os/src/components/data-state.tsx`
- Create: `growth-os/src/components/connection-status.tsx`
- Create: `growth-os/src/features/dashboard/overview.tsx`
- Create: `growth-os/src/features/dashboard/overview.test.tsx`
- Create: `growth-os/src/features/dashboard/pipeline-chart.tsx`
- Create: `growth-os/src/features/dashboard/channel-table.tsx`
- Create: `growth-os/src/features/dashboard/reports.tsx`
- Create: `growth-os/src/features/connectors/connection-list.tsx`
- Create: `growth-os/src/features/connectors/connection-list.test.tsx`
- Create: `growth-os/src/routes/_app.index.tsx`
- Create: `growth-os/src/routes/_app.channels.tsx`
- Create: `growth-os/src/routes/_app.reports.tsx`
- Create: `growth-os/src/routes/_app.connections.tsx`

**Interfaces:**
- Consumes: `getOverview`, lead list functions, normalized channel metrics, connector health, and tenant brand.
- Produces: navigation routes Overview, Leads, Channels, Reports, Connections, and Brand and settings.
- Produces: URL search state `from=YYYY-MM-DD&to=YYYY-MM-DD&model=first_touch|last_touch`.
- Produces: CSV report download generated server-side from the same complete-window query as the visible report.

- [ ] **Step 1: Write failing rendering and stale-data tests**

Use Testing Library to verify all of these states:

```tsx
it("renders missing values as unavailable, not zero", () => {
  render(<MetricValue label="ROAS" value={null} format="ratio" />);
  expect(screen.getByText("Unavailable")).toBeVisible();
  expect(screen.queryByText("0.00x")).not.toBeInTheDocument();
});

it("shows the last successful value with a stale warning", () => {
  render(<ConnectionStatus state="stale" provider="Google Ads" lastSync="2026-08-08T10:00:00Z" />);
  expect(screen.getByText(/stale/i)).toBeVisible();
  expect(screen.getByText(/Aug 8, 2026/i)).toBeVisible();
});
```

Add tests for brand variables, date range in tenant timezone, currency labels, first/last-touch switch, ambiguous and unattributed totals, drill-down links, loading skeletons with fixed dimensions, empty leads, healthy connections, `action_required` guidance, and a client owner never seeing platform-admin controls.

- [ ] **Step 2: Run dashboard tests to verify they fail**

Run: `cd growth-os && bunx vitest run src/features/dashboard src/features/connectors/connection-list.test.tsx`

Expected: FAIL because the dashboard components do not exist.

- [ ] **Step 3: Build the stable authenticated shell**

Use a desktop sidebar and compact mobile drawer with Lucide icons and tooltips. Keep navigation dimensions fixed so loading, badges, and long tenant names do not shift layout. Tenant display name and logo are first-viewport signals. Use a compact top bar for tenant switch, selected date range, freshness, and account menu.

The palette uses tenant primary/accent colors for actions and data emphasis while retaining neutral white, charcoal, gray, green, amber, and red status colors. Cards have at most 8px radius. Page sections remain unframed; cards are used only for individual metrics and repeated connection records. No gradient backgrounds, decorative orbs, oversized headings, nested cards, or in-app tutorial copy.

- [ ] **Step 4: Implement overview metrics and drill-downs**

Render confirmed revenue, marketing spend, ROAS, qualified leads, won customers, qualified-lead rate, close rate, cost per qualified lead, and marketing ROI. Every metric displays currency/timezone/date range and links to a filtered Leads or Channels view. Render pipeline counts and revenue by channel. Include dedicated rows for `Unattributed` and `Ambiguous`; never hide them in an `Other` category.

The date control offers 7, 30, and 90 complete days plus a custom range capped at 366 days. Today is excluded by default because provider windows may still change.

- [ ] **Step 5: Implement channel, report, and connection views**

The Channels table shows provider, campaign, spend, impressions, clicks, provider conversions, qualified leads, confirmed revenue, ROAS, attribution confidence, and freshness. Sort and filter server-side. The Reports view uses the same calculations and supports a CSV with an opening metadata block containing tenant, range, timezone, currency, attribution model, generated timestamp, and freshness per provider.

The Connections view supports connect, account select, manual retry, and revoke. It shows required scopes, selected account, last success, next retry, and a sanitized recovery action. It has no create-campaign, edit-budget, audience, publish, or spend controls.

- [ ] **Step 6: Verify responsive UI and accessibility**

Run: `cd growth-os && bunx vitest run src/features/dashboard src/features/connectors/connection-list.test.tsx && bun run typecheck && bun run build`

Then start `bun run dev` and use Playwright at 1440x900, 1024x768, 390x844, and 360x800. Verify no text overlap, horizontal scrolling, clipped controls, layout shift from loading states, inaccessible icon buttons, or contrast failures. Save screenshots to `growth-os/tests/e2e/screenshots/` only when a visual regression baseline is deliberately adopted; do not commit ad hoc screenshots.

Expected: tests/typecheck/build PASS and all four viewports are usable.

- [ ] **Step 7: Commit the dashboard**

```bash
git add growth-os/src/components growth-os/src/features/dashboard growth-os/src/features/connectors/connection-list.tsx growth-os/src/features/connectors/connection-list.test.tsx growth-os/src/routes/_app.index.tsx growth-os/src/routes/_app.channels.tsx growth-os/src/routes/_app.reports.tsx growth-os/src/routes/_app.connections.tsx growth-os/src/styles.css
git commit -m "feat: add Growth OS ROI dashboard"
```

### Task 12: Implement Export, Restriction, Deletion, Retention, And Audit Views

**Files:**
- Create: `growth-os/src/features/privacy/privacy.schemas.ts`
- Create: `growth-os/src/features/privacy/privacy.server.ts`
- Create: `growth-os/src/features/privacy/privacy.functions.ts`
- Create: `growth-os/src/features/privacy/privacy.server.test.ts`
- Create: `growth-os/src/features/privacy/privacy-settings.tsx`
- Create: `growth-os/src/features/privacy/audit-list.tsx`
- Create: `growth-os/src/routes/_app.settings.privacy.tsx`
- Create: `growth-os/src/routes/_app.settings.audit.tsx`
- Create: `growth-os/src/routes/api.jobs.retention.ts`
- Modify: `growth-os/supabase/migrations/202608090003_release1_jobs.sql`

**Interfaces:**
- Produces: `createPrivacyRequest`, `exportPrivacySubject`, `processDeletionRequest`, and `getAuditEvents` server functions.
- Produces: `runRetentionCleanup(now: Date): Promise<RetentionSummary>`.
- Produces: `RetentionSummary` with deleted counts by table and no deleted record contents.
- Consumes: `Authorization: Bearer <RETENTION_JOB_SECRET>` on the retention route.

```ts
export type RetentionSummary = {
  processedTenants: number;
  deletedByTable: Record<
    "sync_payloads" | "attribution_evidence" | "leads" | "campaign_metrics_daily" | "audit_events",
    number
  >;
  hasMore: boolean;
};
```

- [ ] **Step 1: Write failing privacy lifecycle tests**

Test access, correction, deletion, export, and opt-out request creation; immediate restriction; derived-record export; retryable downstream deletion state; retention cutoffs; tenant-specific shorter lead retention; immutable audit records; and cross-tenant denial. Use fake time exactly at and one second around each cutoff.

```ts
it("restricts a subject before asynchronous deletion begins", async () => {
  const request = await service.createDeletion({
    tenantId: TENANT_A,
    email: "lead@example.com",
    actorId: OWNER_A,
  });
  expect(request.state).toBe("restricted");
  expect(await repository.listVisibleLeads(TENANT_A)).toHaveLength(0);
  expect(await repository.getRestrictedLeadForDeletion(request.id)).toBeDefined();
});
```

- [ ] **Step 2: Run privacy tests to verify they fail**

Run: `cd growth-os && bunx vitest run src/features/privacy`

Expected: FAIL because the privacy service does not exist.

- [ ] **Step 3: Implement immediate restriction and scoped export**

Normalize and HMAC the submitted email or phone; do not store a new plaintext search identity in `privacy_requests`. Match only within the active tenant. In one transaction, mark matching lead records `restricted_at`, create the privacy request, and write `privacy.restricted`. Ordinary list/detail/dashboard queries already exclude restricted rows.

The JSON export contains decrypted lead contact/outcome data, consent receipts, attribution evidence and corrections, confirmed revenue, and audit events directly concerning that lead. It excludes OAuth credentials, other leads, provider raw payloads, internal encryption metadata, unrelated tenant audit records, and server configuration. Generate it server-side, set `Cache-Control: no-store`, and audit the export.

- [ ] **Step 4: Implement deletion as an idempotent state machine**

Use states `received`, `identity_verification`, `restricted`, `deleting`, `downstream_action_required`, `completed`, and `rejected`. After identity verification, delete derived attribution, outcomes, consent receipts, and the lead; retain only a non-reversible deletion tombstone containing tenant id, request id, completion date, legal basis code, and HMAC subject hash needed to prevent accidental re-import. Release 1 read-only connectors have no external personal lead record to delete; if a provider later supplies a deletion API, record and retry that call before `completed`.

Every retry checks current state and cannot duplicate audit events or recreate deleted data.

- [ ] **Step 5: Implement batched retention cleanup**

Delete up to 500 eligible rows per table per invocation in this order: seven-day encrypted sync payloads, 13-month pseudonymous event detail, tenant-configured lead/outcome records, 25-month normalized campaign metrics, then 25-month audit events. Keep privacy tombstones for the documented legal retention period set to 25 months in Release 1. Retention uses tenant timezone for month boundaries and writes one aggregate `retention.completed` audit event per tenant with counts only.

The scheduler endpoint validates the bearer secret with a timing-safe comparison and returns `{ processedTenants, deletedByTable, hasMore }`.

- [ ] **Step 6: Build privacy and audit settings views**

Provide request status, retry controls for administrators, tenant retention controls from 1-24 months, export download, and a filterable audit table. Never present the platform as a legal guarantee. The UI states that configured retention and workflow controls support the client's obligations and that the client remains responsible for lawful use and jurisdiction-specific requirements.

- [ ] **Step 7: Verify privacy and retention behavior**

Run: `cd growth-os && bunx vitest run src/features/privacy && bun run test:db && bun run typecheck && bun run build`

Expected: lifecycle, cutoff, idempotency, export-scope, audit, and cross-tenant tests PASS; build PASS.

- [ ] **Step 8: Commit privacy operations**

```bash
git add growth-os/src/features/privacy growth-os/src/routes/_app.settings.privacy.tsx growth-os/src/routes/_app.settings.audit.tsx growth-os/src/routes/api.jobs.retention.ts growth-os/supabase/migrations/202608090003_release1_jobs.sql
git commit -m "feat: add Growth OS privacy operations"
```

### Task 13: Prove The Release With Two Tenants And Prepare The Pilot

**Files:**
- Create: `growth-os/supabase/seed.sql`
- Create: `growth-os/tests/e2e/release1.spec.ts`
- Create: `growth-os/tests/e2e/security.spec.ts`
- Create: `growth-os/tests/e2e/helpers/auth.ts`
- Create: `growth-os/tests/e2e/helpers/providers.ts`
- Create: `growth-os/tests/security/client-bundle.test.mjs`
- Create: `growth-os/tests/security/schema-privacy.test.mjs`
- Create: `docs/operations/growth-os-release1-runbook.md`
- Modify: `docs/contracts/subprocessor-list.md`
- Modify: `docs/contracts/msa-template.md`
- Modify: `src/routes/privacy.tsx`
- Modify: `growth-os/.env.example`

**Interfaces:**
- Produces: deterministic GivenTake and pilot tenant fixtures with no real personal data.
- Produces: a complete Release 1 test command sequence and operator runbook.
- Produces: deployment configuration for `app.giventakedevs.com`, `/api/jobs/sync`, and `/api/jobs/retention` without coupling business logic to one host.

- [ ] **Step 1: Seed two isolated, branded tenants**

Create fixed UUID fixtures for `GivenTake Devs` and `Pilot Adjusters`, one owner per tenant, distinct colors/logos, three provider connections in fixture mode, 35 complete days of normalized metrics, leads across every status, ambiguous/unattributed cases, confirmed revenue, one stale connection, and one revoked connection. Use `example.com` emails and obviously fictional names. Never seed a real OAuth token; use encrypted fixture markers accepted only when `NODE_ENV=test`.

- [ ] **Step 2: Write the failing complete-flow Playwright test**

The main test performs this exact flow:

```ts
test("owner sees trusted ROI from lead through revenue", async ({ page, request }) => {
  await signInAs(page, "owner-a@example.com");
  await selectTenant(page, "GivenTake Devs");
  const event = makeSignedLeadEvent({ declaredSource: "google", gclid: "gclid-test-1" });
  const response = await request.post("/api/ingest/v1/leads", event.request);
  expect(response.status()).toBe(202);

  await page.goto("/leads");
  await page.getByRole("link", { name: event.leadName }).click();
  await page.getByRole("button", { name: "Qualified" }).click();
  await page.getByRole("button", { name: "Won" }).click();
  await page.getByLabel("Confirmed revenue").fill("3500.00");
  await page.getByRole("button", { name: "Record revenue" }).click();

  await page.goto("/");
  await expect(page.getByText("$3,500.00")).toBeVisible();
  await expect(page.getByText("Google Ads")).toBeVisible();
  await expect(page.getByText(/high confidence/i)).toBeVisible();
});
```

Add tests for brand switching, connection freshness, provider revocation retaining history, date-range drill-down, export, immediate deletion restriction, and selected attribution model.

- [ ] **Step 3: Write cross-tenant and compliance E2E tests**

As tenant A owner, try tenant B through a copied URL, lead UUID, query filter, server function payload, CSV report, privacy export, and direct REST request. Every request must return not found or forbidden with no tenant B value in the body. Verify a platform admin sees no tenant lead before opening a support session and only the chosen tenant during that session.

Load the public website with default consent and GPC enabled. Assert no requests go to Google Analytics, Google Ads, Meta, TikTok, LinkedIn, or Microsoft endpoints. Submit a lead and assert the Growth OS request still occurs server-side with empty click ids. Verify every accepted lead has one `website_lead` receipt and every published provider sync has one `provider_import` receipt; failed or partial syncs have none. Search built client assets and server logs for the test OAuth token, service key, encryption key, lead email, and notes; all searches must return no matches.

- [ ] **Step 4: Run the full local release gate and inspect failures before changing code**

Run:

```bash
bun install
bun run lint
bunx tsc --noEmit
bun run build
node tests/compliance-tracking.test.mjs
node tests/customer-1-pipeline.test.mjs
node tests/customer-1-behavior.test.mjs
node tests/growth-os-handoff.test.mjs
cd growth-os
bunx supabase db reset
bun run test:db
bun run test
bun run lint
bun run typecheck
bun run build
bun run e2e
node tests/security/client-bundle.test.mjs
node tests/security/schema-privacy.test.mjs
```

Expected: every command PASS. Any failure blocks deployment; fix the smallest responsible task and rerun that task's focused tests plus this complete gate.

- [ ] **Step 5: Complete the operational and legal launch inputs**

Document exact setup and recovery steps in `growth-os-release1-runbook.md` for:

1. Creating production and staging Supabase projects with daily backups and point-in-time recovery where the selected plan supports it.
2. Applying migrations, generating types, seeding only local/staging, and running pgTAP before production migration.
3. Creating Supabase redirect URLs for `https://app.giventakedevs.com/auth/callback` and the staging callback.
4. Configuring separate Google GA4 and Google Ads OAuth consent/scopes and a Meta read-only app review.
5. Setting all environment variables from `growth-os/.env.example` in staging and production.
6. Creating DNS for `app.giventakedevs.com` and verifying TLS before adding OAuth redirect URLs.
7. Scheduling daily sync after provider reporting settles and hourly retries for due failed runs.
8. Scheduling retention daily and confirming `hasMore` is drained.
9. Rotating site-signing, OAuth-state, lookup-HMAC, and field-encryption keys without losing `v1` decrypt capability until every record is re-encrypted.
10. Restoring a backup into an isolated environment and rerunning tenant-isolation tests.
11. Revoking a connector, responding to `action_required`, retrying failed deletion, and documenting an audited support session.
12. Running the external-pilot checklist only after the privacy notice, subprocessor list, DPA/client agreement, provider terms, and public-adjuster jurisdiction review are complete.

Update the contracts and privacy page with the actual selected hosting, database/auth, email, analytics, and advertising processors. Do not list a provider that is not enabled. State that Growth OS supports compliance workflows but does not guarantee that a client's offer, solicitation, or targeting is lawful.

- [ ] **Step 6: Perform staging acceptance with provider test accounts**

Deploy the separate app to staging, connect test or sandbox accounts, and run a 30-day initial import followed by an overlapping two-day incremental import. Compare campaign/date spend and conversion totals against each provider UI for five sampled dates. Record discrepancies and do not enable the pilot until currency, timezone, attribution evidence, freshness, and complete-window behavior match.

Use browser verification at 1440x900, 1024x768, 390x844, and 360x800. Confirm the app shell, lead workflow, tables, charts, dialogs, consent states, and error banners have no overlap or clipped text.

- [ ] **Step 7: Commit the release gate and pilot runbook**

```bash
git add growth-os/supabase/seed.sql growth-os/tests docs/operations/growth-os-release1-runbook.md docs/contracts/subprocessor-list.md docs/contracts/msa-template.md src/routes/privacy.tsx growth-os/.env.example
git commit -m "test: gate Growth OS Release 1 pilot"
```

- [ ] **Step 8: Run the final release gate from a clean checkout**

Create an isolated worktree from the final commit, install dependencies without using existing `node_modules`, start local Supabase, and repeat Step 4. Verify `git status --short` is empty afterward.

Expected: every public-site, database, Growth OS unit, connector contract, security, build, and browser test PASS from a clean environment.

---

## Current Implementation References

- TanStack Start server functions and same-origin CSRF: <https://tanstack.com/start/latest/docs/framework/react/guide/server-functions>
- TanStack Start server routes for external callers: <https://tanstack.com/start/v0/docs/framework/react/guide/server-routes>
- TanStack Start server-only execution: <https://tanstack.com/start/latest/docs/framework/react/guide/execution-model>
- Supabase row-level security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Google Analytics Data API `runReport`: <https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport>
- Google Ads GAQL: <https://developers.google.com/google-ads/api/docs/query/overview>
- Google Ads REST Search and SearchStream: <https://developers.google.com/google-ads/api/rest/common/search>
- Google OAuth web-server flow: <https://developers.google.com/identity/protocols/oauth2>
- Meta Marketing API collection maintained by Meta: <https://www.postman.com/meta/facebook-marketing-api/documentation/0zr4mes/facebook-marketing-api-mapi>

Recheck provider API versions, OAuth scopes, App Review requirements, and policy terms at implementation and again before staging acceptance. Keep API versions in server configuration and update fixtures plus contract tests before changing them.
