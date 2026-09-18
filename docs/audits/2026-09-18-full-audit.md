# GiveNTake Devs: full audit, 2026-09-18

Branch audited: `docs/executor-spec-truth` at `b02e906` (one docs commit ahead of `main`).
Production project: Supabase `qsgijpsttojutuhogbns`, site `https://giventakedevs.com`.

Nine audits ran in parallel, all read-only: security, database, SEO, performance,
TypeScript quality, silent failures, a lint/type/test/build baseline, a map of every
place the repo touches the Sami agent, and web research on Hermes Agent. Findings
marked **verified live** were re-checked by hand against production or the code after
the audit agent reported them. Nothing in the repo or in production was changed.

## The twelve things that matter, in order

| # | Finding | Where | Status |
|---|---|---|---|
| 1 | `service_role` is denied on `leads`, `touchpoints`, `agent_log`, `clients`, `projects`, `invoices`, but the app writes to four of them directly and the MCP function reads three. Those code paths get `permission denied` in production. | `src/server/crm/actions.ts:361,386,408,479`; `supabase/functions/giventake-mcp/index.ts:186,219,236,249,320,326` | verified live |
| 2 | `service_role` has full read/write on 24 other tables, outside RLS and outside every guarded RPC. `approval_queue`, `documents`, `document_signatures`, `deals` are among them. | 12 migrations that revoke only from `anon, authenticated` | verified live |
| 3 | Production is 8 migrations behind the repo. `job_applications`, `demo_sites`, `giveaway_entries` and the three `mail_*` tables do not exist, so the careers form, demo-sites app, giveaway and CRM mail (PRs #45, #46) have no backing tables. | `supabase/migrations/2026083021…` to `2026091211…` | verified live |
| 4 | The migration chain cannot rebuild production. `pipeline_stages`, `deal_stage_events`, `pipeline_stages_list()`, `attribution_snapshot()` and three `deals` columns exist live with no migration that creates them. Three applied migrations are recorded under different versions than their repo filenames, so `supabase db push` would try to re-apply them. | `supabase/migrations/` | verified live |
| 5 | Unsubscribe swallows a failed write and always says "You have been unsubscribed". A missing env var makes every unsubscribe a silent no-op. CAN-SPAM exposure. | `src/routes/api.unsubscribe.$token.ts:21,27-29` | verified in code |
| 6 | No abuse control on any public form: no captcha, honeypot or rate limit. Each submission sends a live Resend email and writes a lead; the careers form accepts a ~6.5 MB upload. | `src/lib/intake.ts`, `src/lib/intake-schema.ts` | agent finding |
| 7 | Private routes are indexable. `robots.txt` is `Allow: /`; `/crm`, `/sign/$token`, `/operator-dashboard` set no `noindex`. The e-signature links are the real exposure. | `public/robots.txt`, four route files | agent finding |
| 8 | No security headers anywhere (CSP, HSTS, `X-Frame-Options`, `nosniff`). `/crm/login` can be framed. | `src/server.ts`, `wrangler.jsonc` | agent finding |
| 9 | A literal placeholder is live on `/privacy` and `/terms`: `[registered business address, Ohio]`. It is the only address on the site. | `src/lib/seo.ts:39` | seen in live HTML |
| 10 | `tsc` fails with one error on `main`: `proposed_payload: unknown` is not serializable from a server function. CI's `verify` job should be red on it; not confirmed. | `src/lib/crm-data.ts:93,294` (PR #47) | reproduced locally |
| 11 | `package-lock.json` is stale (38 pins disagree with `package.json`, `npm ci` would fail) and local `node_modules` matches neither lockfile. CI uses `bun.lock`; bun is not installed on this PC. | repo root | reproduced locally |
| 12 | Sami has authenticated to the CRM once, ever (2026-09-05, a curl probe). `agent_sami` still has no password, `crm_agent` is still live, the approval queue has 0 rows. | `channel_auth_log`, `pg_roles` | verified live |

Items 1 to 4 are one piece of work: a single reconciling migration set that records
what production already has, applies the 8 missing migrations, and replaces the
blanket table grants with an explicit allowlist (or moves the four direct writes to
RPCs, which is what the design documents already say they want).

## 1. Production database

Checked live with read-only SQL plus the Supabase advisors.

**Grants are wrong in both directions.** A `set local role service_role` probe,
rolled back, returned `PERMISSION DENIED` for `leads`, `touchpoints`, `agent_log`,
`clients`, `projects`, `invoices` and `ok` for `deals`, `tasks`. No migration grants
those six back. Meanwhile `has_table_privilege` shows all four privileges on 24
tables. The cause is one blanket revoke in `20260814180000_operator_security_hardening.sql:115`
that covered only tables existing that day; every later migration revoked from
`anon, authenticated` and left Supabase's default `service_role` grant in place. The
migration authors know: `20260906120000_agent_capabilities.sql:33-40` says so in a
comment.

What breaks today because of the closed side: `setLeadStatus`, `createClient`,
`createProject`, `createInvoice`, and `assign` on leads in `actions.ts`; and the MCP
tools `pipeline_summary`, `list_leads`, `get_lead`, `recent_activity`. Which CRM
buttons reach those methods has not been traced.

**`approval_queue` is weaker than `operator_approvals`.** No immutability or hash
trigger, `approval_decide` does not check that the decider differs from the
proposer, and with the open grants a service-role caller can set `status='approved'`
directly. This is the table the Sami approval executor is built on.

**Member scoping is TypeScript, not SQL.** `src/server/crm/read.ts:81-118` fetches
with the service role and filters by `owner_id`/`assigned_to` afterwards. With the
grants as they are, that filter is the only thing between a non-admin CRM user and
everyone's records.

**Advisors.** Security: 39 tables with RLS and no policy (expected for a
service-role-only design), `deny_audit_mutation` has a mutable `search_path`, leaked
password protection is off. Performance: 25 unindexed foreign keys (the ones on
`deals`, `contacts`, `touchpoints`, `notes`, `tasks` matter first), 24 unused
indexes, which at this data volume means little.

**Checked and fine:** RLS enabled and forced on every table, no `using (true)`
policy anywhere, every SECURITY DEFINER function pins `search_path`, EXECUTE locked
to `service_role` and the agent roles, agent roles hold no table grants and no
BYPASSRLS, money is `numeric`/cents, capture RPCs allowlist their payload keys,
`mail_accounts` is locked even from `service_role`.

## 2. Application security

No critical finding. The auth, authorization, token and webhook surfaces were traced
end to end and hold: every CRM server function goes through `requireCrmSession` or
`requireAdmin`; non-admin reads are scoped; Google OAuth uses PKCE with a
server-side Workspace domain check and fixed redirect targets; role comes from
`app_metadata` only; the sign token is a 122-bit UUID with a 7-day expiry and GET
never signs; the campaign unsubscribe token is HMAC with a constant-time compare;
the Resend webhook verifies the Svix signature with a timestamp window; the operator
dashboard is off by default and needs loopback plus a 43-character token; no
user data reaches `dangerouslySetInnerHTML`; no secret is `VITE_`-prefixed or
committed.

Open items: public-form abuse (High), missing security headers (Medium), the
prompt-injection channel through lead free text into the MCP tools (Low while the
surface is read-only; it becomes the main risk the day a write tool is added),
`src/integrations/supabase/client.ts` is a dead Lovable scaffold that builds a
browser Supabase client and should be deleted, and `newsletter_unsubscribe(p_email)`
takes a bare email with no token (no caller today; do not wire it up as is).

## 3. Silent failures

1. Unsubscribe, above. High.
2. `giventake-mcp/index.ts:423-426`: the audit write on the no-token path is
   fire-and-forget with no `EdgeRuntime.waitUntil`, so the log is least reliable for
   the traffic it exists to count. The wrong-token path awaits correctly.
3. `src/lib/crm-data.ts` is 1,752 lines with zero logging, and `:604-612` and `:934`
   turn a failed read into an empty list. A failed stage read renders as an empty
   "advance stage" dropdown.
4. `documents-data.ts:341-346` and `mail-data.ts:68-79` report any exception as
   "migration may not be applied yet". With the mail migrations really unapplied in
   production, a genuine bug there cannot be told apart from the expected state.
5. `src/server/approvals/execute.ts:186-200` records a refusal on the approval row
   but logs nothing server-side.
6. `src/server/crm/auth.ts`: a GoTrue 5xx is handled the same as an expired token,
   unlogged. Fails closed, but an auth outage would log every user out with no trail.

The fail-open choices in `channel-auth.ts`, `intake.ts`, `campaigns/policy.ts`,
`demo-sites/access.ts` and `campaigns/inbound.ts` were judged correct: each is
logged and fails in the safe direction.

## 4. Website and SEO

Public pages are server-rendered with real content, canonicals are right, and
`/pricing` has valid FAQ schema. The problems:

- Private routes indexable (item 7). One response-header layer fixes this and the
  missing security headers together.
- The address placeholder (item 9), plus no phone, no `sameAs`, no
  `LocalBusiness`/`ProfessionalService` schema. "Ohio" appears only in legal
  boilerplate, so there is no local-search signal at all.
- Sitemap omits `/careers` and has no `lastmod`.
- `/guardrails` and trailing-slash redirects return 307, should be 301.
- `www.` and `http://` both serve 200 instead of redirecting. Cloudflare rule, not
  code.
- Smaller: home page builds its head by hand and lacks the `robots` meta the other
  routes get from `pageHead()`; no `BreadcrumbList`; no FAQ schema on
  `/how-we-use-ai`; three titles over 70 characters; the preloaded font is served
  `max-age=0`; no `llms.txt`.
- Placeholders visible to visitors: `careers.tsx:44` has an empty `applyUrl`, the
  hero panel says "Product showreel coming soon", and the case studies are labelled
  illustrative. There is no real portfolio proof on the site.
- Content gaps: no location page, no industry page, no comparison page.

## 5. Code quality

Overall high: `strict: true`, `any` confined to generated files, the six non-null
assertions are all guarded, error and pending components are inherited correctly
from `crm.tsx` and `__root.tsx`.

- `services/video-worker/src` is empty. No source, no `package.json`, nothing
  references it.
- Dead but finished logic: `src/lib/attio-mapping.ts`, `qualification-brief.ts`,
  `prospect-qualification.ts`. The last two have tests and no importer. Nothing
  flags this because `no-unused-vars`, `noUnusedLocals` and `noUnusedParameters`
  are all off.
- `tests/customer-1-pipeline.test.mjs` asserts on source text with
  `readFileSync(...).includes(...)`.
- `src/lib/crm-auth.server.ts` (cookie flags, domain gate) has no direct test.
- `EntityForm` in `src/components/crm/ui.tsx` calls `window.location.reload()` after
  each save; the rest of the CRM uses `router.invalidate()`.
- Large hand-written files: `crm-data.ts` 1,752 lines, `crm.deals.$id.tsx` 1,011,
  `components/crm/ui.tsx` 638, `giventake-mcp/index.ts` 509, `crm/actions.ts` 497.
- Stubs: `crm.sami.tsx` (canned replies, no network code); `send_email` and
  `demo_site` approvals are accepted then refused as not implemented
  (`execute.ts:157-165`).

## 6. Build, tests, dependencies

| Check | Result |
|---|---|
| `tsc --noEmit` | 1 error, `crm-data.ts:294` |
| `eslint` | 10,428 errors locally, all CRLF (160 files never renormalized); 0 errors and 1 warning on LF |
| `prettier --check` | 1 genuinely unformatted tracked file, `src/styles.css` |
| `npm test` via npm on Windows | fails: bash loop handed to `cmd.exe` |
| same loop in Git Bash | 49/49 files, 546/546 tests, 1 integration file skipped |
| vitest components | 25/25 |
| build | passes, 9 s |
| worker smoke (wrangler 4.130.0) | 5/5 |
| `npm audit` | 0 critical, 5 high, all transitive build/lint tooling, none shipped |
| outdated | 10 majors behind: recharts 3, TypeScript 7, eslint 10, vitest 5, lucide-react 1, react-day-picker 10, others |

Client JS 955 kB (291 kB gzip); entry chunk 331 kB; a 107 kB chunk carries the zod
intake schema. Three videos are 5.4 MB of the 6.9 MB of client assets. Server
bundle 2.28 MB (529 kB gzip).

Hygiene: two lockfiles with 44 of 75 direct dependencies disagreeing; no `.nvmrc`,
`engines` or `packageManager`; CI installs bun `latest` without a frozen lockfile;
CI has no audit or prettier step; `check.sql` and `migration-objects.json` sit
untracked and un-ignored at the root.

## 7. Performance

Audited from source and the existing `.output` build. No CRM-only code leaks into
the public site's critical path, and nothing new does work at module scope (the
class of bug behind the 2026-09-08 outage). The Worker bundle is well inside
Cloudflare's size limits.

1. **Loader waterfalls in four CRM routes (High).** Independent server calls are
   awaited one at a time: `crm.deals.index.tsx:16-20` (3), `crm.contacts.index.tsx:34-37`
   (2), `crm.companies.$id.tsx:26-29` (2), `crm.deals.$id.tsx:45-60` (5). Every
   other loader in `crm-data.ts` already uses `Promise.all`. On the deal page keep
   documents and demo sites after `crmDeal()`, as the in-code comment about the
   auth gate requires; `crmStages()` and `listAssignableMembers()` can run beside
   it. Five serial round trips become two batches.
2. **No `Cache-Control` on any HTML (High).** Only `/assets/*` is cached. Every
   request for `/`, `/pricing`, `/privacy` and the rest is a full SSR render on the
   Worker with no browser or edge reuse. Add short `max-age` with `s-maxage` and
   `stale-while-revalidate` for the static marketing and legal routes; leave `/crm`
   and anything session-scoped uncached. Belongs in the same response-header layer
   as `noindex` and the security headers.
3. **Case-study images (Medium).** `src/assets/case-intake.png`, `case-booking.png`,
   `case-dashboard.png` are 840 to 900 kB each as raw PNG, no WebP or AVIF, no
   `srcset`. They are lazy-loaded with explicit dimensions and only ship on `/work`.
4. **Entry chunk is 107 kB gzip (Informational).** It is React 19 plus TanStack
   Router and Start, not app code. Track it when upgrading; there is no app-level
   fix.
5. **Dead dependencies (verified by hand).** `src/components/ui` has only seven
   components. Nothing in `src/` imports `recharts`, `cmdk`, `react-hook-form`,
   `@hookform/resolvers`, `embla-carousel-react`, `react-day-picker`, `input-otp`,
   `vaul` or `react-resizable-panels`, and most of the 27 Radix packages are unused
   too. They ship zero bytes, so this is install time and audit surface, not page
   weight. It also turns three of the "major version behind" items in section 6
   into removals. `@tanstack/react-query` is imported only to mount a
   `QueryClientProvider` that no `useQuery` ever uses (`src/router.tsx:6`,
   `src/routes/__root.tsx:168`).

One disagreement between audits: the performance audit reports no `select('*')` in
the data layer, while the security and database audits cite `select=*` in
`CrmRead#getById` and `select("*")` at `giventake-mcp/index.ts:236`. The second is
confirmed by grep; treat the first claim as covering list methods only.

## 8. The Sami agent, and OpenClaw to Hermes

### What the CRM side looks like today

- **Read surface:** `giventake-mcp`, JSON-RPC over POST, `x-sami-token` header,
  seven read-only tools, audited in `channel_auth_log`. Four of the seven are broken
  in production by the grants problem.
- **Write surface:** direct Postgres as `crm_agent` (target `agent_sami`), ten
  SECURITY DEFINER functions behind `agent_require` and `agent_capabilities`,
  audited in `operator_audit_events`.
- **Approvals:** Sami proposes with `approval_request`, a human decides in
  `/crm/approvals`, the executor re-validates and runs. Only `deal_close` executes.
- **VPS jobs the repo expects:** a Gmail poller (holds the OAuth client and a
  32-byte token-encryption key) and a demo-site builder (Google Places key, Vercel
  deploy token). Their RPCs are not behind `agent_require`, and the demo-site ones
  are granted to `crm_agent` only. Revoking `crm_agent` as the deploy order says
  would strand the demo-site builder.
- **Other identities:** Piper, Cade, nova and "inbox" are configured and idle.
  `agent:piper` rows exist up to 2026-09-02.
- **OpenClaw coupling:** one functional item, the dummy GET SSE stream
  (`index.ts:449-479`), plus four doc sentences and one code comment. Everything
  else is a Postgres role and a token, which no framework owns.
- **Gaps for any capable agent:** no chat bridge (`crm.sami.tsx` is a stub and no
  spec defines the bridge), no write tools over MCP, no push to the agent, no
  memory or SOP endpoint.

### What the research says about Hermes Agent

From the Nous Research docs and repository, read through a summarising fetcher, so
confirm on the box. v0.21.3 dated 2026-09-14, MIT, Python, monthly minors,
`hermes update` tracks `main`.

- `hermes claw migrate` exists, previews first, has `--dry-run`, writes a backup
  zip. Imports SOUL.md, memory, skills, model config, channel allowlists and MCP
  servers. Does not import cron jobs, HEARTBEAT.md, plugins, hooks or sessions.
- It copies MCP `headers` in plaintext whether or not `--migrate-secrets` is set.
  Expect `x-sami-token` readable in `config.yaml` until moved to `.env`.
- A 405 on GET is reportedly not fatal (HEAD, then GET, then a POST probe;
  `skip_preflight` available), so the SSE workaround can probably go after a live
  test.
- Per-server `tools.include`, `trust: untrusted`, and sampling is on by default and
  should be turned off for the CRM server.
- Telegram is outbound long polling, no inbound port. Allowlist is default-deny.
- Built-in cron with a no-agent script mode, which suits the Gmail poller.
- In-chat approval for risky commands; the pattern list includes SQL `DROP`,
  `TRUNCATE` and `DELETE` without `WHERE`.
- Cautions: a fast-moving `main`; v0.21.2 was an emergency session-store fix; a
  third-party tracker lists 44 CVEs of unclear patch status; the project's own
  policy says the OS is the only real boundary. Run it as an unprivileged user with
  the Docker terminal backend.
- OpenClaw's advisory history is long and includes a one-click RCE. Treat every
  secret the old install held as exposed and remove it after cutover.

### Recommended cutover

1. Fix the CRM side first (items 1 to 4, and re-grant the poller RPCs to
   `agent_sami`), or Hermes connects to a half-broken tool list.
2. Snapshot the VPS. Create an unprivileged `hermes` user, install, `hermes doctor`.
3. Copy `~/.openclaw` somewhere that user can read. `hermes claw migrate --dry-run
   --preset user-data`. Review. Apply without `--migrate-secrets`.
4. Issue new secrets instead of migrating: `SAMI_CHANNEL_TOKEN`, the `agent_sami`
   password (this closes deploy step 2, open since 2026-09-06), the model key.
5. Add the MCP server with an include list, `trust` set, sampling off. Diff the tool
   list.
6. Shadow-test on a second Telegram bot. Never two pollers on one token.
7. Recreate cron jobs by hand; make the Gmail poller a no-agent script.
8. Smoke: unauthorized sender, one MCP read, one Postgres write, one approval
   round-trip, cron delivery, gateway restart.
9. Cut over, soak, then revoke `crm_agent`, rotate everything the old install held,
   and purge OpenClaw. Do not run `hermes claw cleanup` while OpenClaw is alive.

Rollback until step 9: stop the Hermes gateway, re-enable the OpenClaw unit.

## Suggested order of work

**Phase 0, stop the bleeding (small, mostly independent):** the migration and grants
reconciliation; unsubscribe logging; the `tsc` error; one lockfile; line-ending
renormalize; the address placeholder and careers `applyUrl`; `robots.txt` plus a
response-header layer for `noindex` and security headers; Turnstile on the three
public forms.

**Phase 1, website upgrade:** needs a design conversation first. Inputs from this
audit: real NAP and local schema, real case studies in place of illustrative ones,
location and industry pages, sitemap and redirect fixes, the performance findings.

**Phase 2, Hermes cutover:** the sequence above. The open design question is whether
Sami's writes move from free-form `psql` to MCP tools on the existing edge function.

## Caveats on this audit

- The SEO agent was told never to request private routes on the live site and did
  anyway, once each: `/crm/login`, `/crm`, `/operator-dashboard`,
  `/sign/test-token`. Unauthenticated GETs with a made-up token; it reported this
  itself and stopped.
- Local build, tests and smoke ran against a `node_modules` that matches neither
  lockfile, so runtime versions differ from CI and production.
- The Hermes section is web research through a summarising fetcher. Its own
  unverified list: the 405 and header-copy behaviour were not read line by line,
  CVE patch status, whether releases can be pinned, whether `psql` with `~/.pgpass`
  works under the local terminal backend.
- CI status for the `tsc` error was not checked; no GitHub access from this session.
