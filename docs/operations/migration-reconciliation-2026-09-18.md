# Migration reconciliation runbook

Status: **applied to production on 2026-09-23** (P1 and P2 by the CLI from this
machine, P3 `supabase db push --linked --include-all` run by Salem in his own
shell after the CLI was linked; all nine files applied, "Finished supabase db
push"). Rehearsed end to end on a local production-equivalent database on
2026-09-18. Branch `fix/migration-reconciliation`.

Verified after the push: history holds 38 rows with no MCP-assigned versions
left (the 21 pre-existing rows without stored SQL remain, as expected); the six
write RPCs and the six new tables exist; all 45 public tables have RLS forced;
`service_role` can SELECT exactly the 19 allowlisted tables and holds no write
privilege on any table; `anon`, `authenticated`, `crm_agent` and `agent_sami`
reach no table; `function_search_path_mutable` is gone from the security
advisor; the site and the CRM answer 200. Correction, verified in the Cloudflare dashboard on 2026-09-23: the branch push
on 2026-09-18 only uploaded a Worker version (`fa73219a` in Version History).
Workers Builds deploys the production branch `main` alone, and Deployment
History shows no deployment between 2026-09-13 (`5332935c`, PR #48) and the
merge of this branch to main on 2026-09-23. So the app change in
`src/server/crm/actions.ts` went live only with that merge, after the RPCs
existed. The six dashboard writes were nevertheless broken before the push, by
the `service_role` grants problem measured below, not by a missing function.
Background is in
`docs/audits/2026-09-18-full-audit.md`, items 1 to 4.

## What was wrong, measured on 2026-09-18

**History.** Production records 27 migrations; the repo had 35. 21 of the 27 rows
have `statements = NULL` (recorded as applied, SQL never stored), which is why a
Supabase branch of this project comes up empty with `MIGRATIONS_FAILED`.

| Repo file | Production history |
|---|---|
| `20260830210000_leads_list_owner_fields` | not recorded; effect present |
| `20260831120000_campaign_engine` | recorded as `20260831215131` |
| `20260831140000_channel_auth` | recorded as `20260831233011` |
| `20260902120000_documents_esignature` | recorded as `20260909155145`, byte-identical to the repo file |
| `20260903120000_job_applications` | **not applied** |
| `20260911223000_demo_sites` | **not applied** |
| `20260911230000_demo_site_request_logging` | **not applied** |
| `20260912073000_giveaway_entries` | **not applied** |
| `20260912090000_mail_surface` | **not applied** |
| `20260912100000_mail_account_status` | **not applied** |
| `20260912110000_mail_account_write` | **not applied** |

**Objects with no migration.** Found by replaying the chain onto an empty Supabase
Postgres and diffing the result against production, object by object:

- the `crm_agent` role (the replay stopped at `20260820120000` without it), and 17
  of the 22 function grants it holds
- `pipeline_stages` with its 12 rows, `deal_stage_events`
- `pipeline_stages_list()`, `attribution_snapshot()`, the pre-guard
  `deal_advance_stage`
- `deals.lead_id`, `closed_at`, `lost_reason`, and `deals_stage_fkey`
- `clients.lead_id`, `clients.deal_id`
- `referrals.amount`, `paid_at`, `invoice_id` (the Referrals page reads `paid_at`)

All of it is now in `20260820110000_crm_out_of_band_baseline.sql`. The version is
deliberate: before `20260820120000` (which grants to `crm_agent`), after
`20260819140000_force_rls` (production's pipeline tables are not FORCEd), before
`20260821200000` (production's column order puts these columns ahead of `owner_id`).

**Grants.** `service_role` held every privilege on 24 tables and none on `leads`,
`touchpoints`, `agent_log`, `clients`, `projects`, `invoices`. The code reads 19
tables directly and wrote 11.

- `20260918120000_service_role_grants_reconciliation.sql`: revoke everything, grant
  `SELECT` on the 19, reset default privileges, FORCE RLS everywhere, pin
  `deny_audit_mutation`'s search_path, then assert the end state or roll back.
- `20260918121000_crm_write_rpcs.sql`: `crm_assign`, `deal_link_lead`,
  `lead_set_status`, `client_create`, `project_create`, `invoice_create`.
  `service_role` only. `src/server/crm/actions.ts` calls them; it no longer
  addresses any table.

## What the rehearsal proved

Local Supabase Postgres 17.6 (same image family and the same legacy default
privileges as production), scratch workdir, port 55322.

1. **The chain rebuilds production.** Replayed in production's applied order with
   the baseline in place, the result matches production on every table's columns,
   constraints, indexes, triggers, RLS flags and ACL (39 of 39), every function's
   attributes and ACL (75 of 75), sequences, enums and default privileges.
2. **No function's code has drifted.** 69 of 75 bodies are byte-identical. The other
   six (`agent_require`, `campaign_claim_due`, `campaign_claim_step`,
   `campaign_mark_by_message`, `channel_auth_record`, `leads_list`) differ only in
   comments and whitespace: production was given comment-stripped copies. Five
   match after stripping comments and collapsing whitespace; `leads_list` was read
   side by side and is token-identical.
3. **The production procedure works with the real CLI.** Against a local copy of
   production's state carrying a copy of production's 27 history rows: P1 repaired,
   P2's dry run listed exactly the nine expected files and not the baseline, P3
   applied all nine, and the end state was identical to the expected fingerprint.
   History ended at 38 rows for 38 files with no MCP-assigned versions left.
4. **Order does not matter.** Production order plus the procedure, and a fresh
   rebuild in plain filename order, produce identical databases.
5. **The grants are what they say.** As `service_role`: `SELECT` succeeds on exactly
   the 19 allowlisted tables and is denied on the other 26; no `INSERT`, `UPDATE`,
   `DELETE` or `TRUNCATE` succeeds on any table. All 63 RPCs the app calls are
   executable. `anon`, `authenticated`, `crm_agent` and `agent_sami` reach no table.
   The six write RPCs are executable by `service_role` and nobody else.
6. **It does not lean on Supabase's defaults.**
   `tests/crm-grants.integration.test.mjs` rebuilds all 38 migrations on bare
   `postgres:17`, which has none of them, and asserts the same end state plus the
   behaviour and refusals of each write RPC. Run it with `npm run test:integration`.

Repo checks after the change: 50 of 50 unit test files, build, Worker smoke 5 of 5.
`tsc` reports the one error it reported before (`src/lib/crm-data.ts:294`, from PR
#47), and nothing new.

## Production procedure

Nothing here runs until the exact SQL has been approved. Deploy the app change
(`src/server/crm/actions.ts`) and the migrations together: the new code calls
functions that P3 creates, and P3 removes the privileges the old code assumes. Four
of the six writes are already refused in production today, so the window only
matters for `assign` and `linkDealToLead`.

**P0. Before.** Take a backup (dashboard, or confirm PITR). Pick a quiet time: P3
takes a brief `ACCESS EXCLUSIVE` lock on every public table for `force row level
security`. Record the current state:

```sql
select version, name, statements is not null as has_sql
from supabase_migrations.schema_migrations order by version;
```

**P1. Repair history.** Metadata only; no schema object changes.

```bash
supabase migration repair --status reverted 20260831215131 20260831233011 20260909155145
supabase migration repair --status applied  20260820110000 20260830210000 \
  20260831120000 20260831140000 20260902120000
```

**P2. Dry run.** `supabase db push --include-all --dry-run`. `--include-all` is
required because `20260903120000` is older than the newest applied version. It must
list exactly these nine and nothing else. If it lists anything else, stop.

```
20260903120000_job_applications.sql
20260911223000_demo_sites.sql
20260911230000_demo_site_request_logging.sql
20260912073000_giveaway_entries.sql
20260912090000_mail_surface.sql
20260912100000_mail_account_status.sql
20260912110000_mail_account_write.sql
20260918120000_service_role_grants_reconciliation.sql
20260918121000_crm_write_rpcs.sql
```

**P3. Push.** `supabase db push --include-all`. The grants migration ends with an
assertion block and rolls itself back if the final state is not the allowlist.

**P4. Verify.** As `service_role`, `select 1 from public.leads limit 1` succeeds and
`select 1 from public.documents limit 1` is denied. Re-run the Supabase security
advisor; `function_search_path_mutable` should be gone. Load the CRM pages that were
failing: a lead's timeline, Clients, and convert-deal-to-client. Call
`pipeline_summary` on giventake-mcp. Regenerate
`src/integrations/supabase/types.ts`, which predates six tables.

## Rollback

- **P1** is reversed by the opposite `repair` calls. No data is involved.
- **The seven feature migrations** create new tables and functions only. Nothing
  existing depends on them; leaving them in place is safe if a later step fails.
- **The grants migration** is transactional, so a failure leaves production as it
  was. If it succeeds and something unforeseen breaks, the emergency lever is a
  single statement per table (`grant select on public.<table> to service_role`).
  Do not restore the old blanket grants; find the access that was missed and add
  it to the allowlist, in a migration.
- **The write RPCs** are additive. Reverting the app change without reverting the
  grants leaves the six writes refused, which is where four of them are today.

## Found along the way, not fixed here

- **`digest()` cannot resolve in production.** `operator_protect_approval` (a trigger
  on `operator_approvals`) and `operator_record_synthetic_draft_approval` call
  `digest()` with `search_path = public, pg_temp`. On Supabase pgcrypto lives in the
  `extensions` schema, so the call fails; confirmed on the local Supabase image. The
  repo's operator integration test passes because plain Postgres installs pgcrypto
  into `public`. Core `sha256()` would remove the dependency.
- `approval_queue` has no immutability trigger and `approval_decide` does not stop a
  proposer approving their own request. Closing direct table writes removes the
  bypass; the missing trigger is separate work.
- `demo_requests_pending()` and `demo_site_set_result()` are granted to `crm_agent`
  and not `agent_sami`. Revoking `crm_agent` strands the demo-site builder. Belongs
  to the Hermes cutover.
- `createInvoice` in `src/lib/crm-data.ts` is called from no route.
- `invoices.currency` holds `'usd'` from `convert_won_deal` while the dashboard sent
  `'USD'`. `invoice_create` stores lowercase.
- 25 unindexed foreign keys from the performance advisor.
