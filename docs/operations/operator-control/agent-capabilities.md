# Agent capabilities — turning them on and off

What an agent may do in the CRM database, and how to change it.

**Before 2026-09-06 the global kill switch enforced nothing.** `operator_system_control.operators_enabled`
read `false` from 2026-08-18 onward and no write function consulted it. Sami read
that switch and chose to respect it — good behaviour from a well-configured agent,
but not a control. The capability migration
(`supabase/migrations/20260906120000_agent_capabilities.sql`) makes it real.

## What this governs, and what it does not

It governs **agents connecting directly to Postgres as their own role** — which is
how Sami connects, using a password file on the Hetzner VPS.

It does **not** govern the dashboard. `src/server/crm/actions.ts` reaches the same
functions through PostgREST, which logs in as `authenticator` and then `SET ROLE`s
to `service_role`. `SET ROLE` does not change `session_user`, so every dashboard
write arrives at the guard as `authenticator`, and the guard lets those through.
That path is authenticated and audited at the application layer.

The full exemption list is `authenticator`, `postgres`, `supabase_admin` and
`cli_login_postgres` — the app path plus the three admin logins that own these
functions and could drop any guard anyway. `cli_login_postgres` is on it because
that is the login you would be using to fix something under pressure, and being
refused by your own guard mid-incident is a bad afternoon.

It is a closed list, not a name pattern. Anything not on it needs a capability row,
so a role added later denies by default instead of slipping through.

So: **anything holding the service-role key is outside this boundary, with one
named exception.** Since migration `20260924120000_agent_asserted_identity.sql`
the CRM Worker's `/mcp` gateway may send `x-agent-role: agent_perplexity` on a
PostgREST call, and the guard then runs the full checks under that name: the
kill switch, the capability row, the audit row. The Worker is the one trusted
asserter; it already holds the key, so this widens the boundary by exactly one
component and nothing else can assert an agent (only `service_role` reaches
these functions through PostgREST). Without the header the app path is exempt
as before. Agents today: `agent_sami` and `crm_agent` (both NOLOGIN since
2026-09-23, no longer used) and `agent_perplexity` (asserted, see
`docs/integrations/perplexity-mcp-connection.md`).

## Turn one capability off

```sql
update public.agent_capabilities
   set enabled = false, updated_at = now(), updated_by = 'salem'
 where agent_role = 'agent_perplexity'
   and capability = 'deal_advance_stage';
```

Effective immediately, on the agent's next call. No deploy, no restart.

To turn it back on, set `enabled = true` the same way.

## Stop everything

```sql
update public.operator_system_control
   set operators_enabled = false, updated_at = now(), reason = 'why you did this'
 where id = 'global';
```

One flip, every agent, every capability. The guard consults this **before** any
capability row, so it cannot be overridden by a row that says otherwise.

The dashboard keeps working — see above. This stops agents, not people.

## What each refusal means

The guard raises with a distinct reason so an agent can tell these apart and report
which one it hit, rather than retrying blindly.

| Reason | Meaning | Fix |
|---|---|---|
| `operators_disabled` | The global kill switch is off | Flip `operators_enabled` back on, if you meant to |
| `capability_missing` | No row for this `(agent, capability)` pair | Insert one. A missing row denies by design, so a newly added write function is off for every agent until someone turns it on |
| `capability_disabled` | The row exists and says `false` | Set `enabled = true` |

An agent seeing any of these should surface it, not work around it.

## Who did what

The two outcomes are recorded in two different places, and the reason is not
cosmetic.

**Allowed calls go to `public.operator_audit_events`:**

```sql
select created_at, operator_key, event_type, details
  from public.operator_audit_events
 where event_type = 'capability_allowed'
 order by created_at desc
 limit 50;
```

`operator_key` is the agent role, `details` carries `{capability}`. The table is
append-only — `operator_audit_no_update_delete` blocks UPDATE and DELETE — so an
agent cannot erase its own trail. These rows commit with the write they authorised,
which is what makes them a usable answer to *what did Sami change last Tuesday*.

**Refusals go to the Postgres server log, not that table.** A refusal raises, the
raise aborts the transaction, and any row inserted before it is rolled back with
everything else. An audit row written before the raise would therefore look like a
trail while never surviving — worse than none, because you would query for denials,
find zero, and conclude nothing had been refused.

The server log is not transactional, so the guard emits `RAISE WARNING` there
before raising. Look for it in the Supabase dashboard logs, or:

```
agent_capability_denied caller=<role> capability=<fn> reason=<why>
```

If durable denial rows in the table are ever wanted, that needs an autonomous
transaction — `dblink` is available on this project but not installed, and
`pg_background` is not available at all. That is a deliberate future change, not
something to assume is already happening.

## Applied: 2026-09-06, step 1 only

Applied to project `qsgijpsttojutuhogbns` at 19:27 UTC on 2026-09-06, after a
full dry run inside a rolled-back transaction. Recorded in
`supabase_migrations.schema_migrations` as version `20260906120000` (the
Supabase MCP stamps its own version on apply; the row was reconciled to the
repo's so `supabase db push` does not try to apply it twice).

Verified immediately afterwards, read-only:

- all ten bodies md5-match their pre-apply production bodies once the guard line
  is stripped, and the guard is the first statement in each
- 20 capability rows, all enabled, for `agent_sami` and `crm_agent`
- `agent_sami`: login, noinherit, no BYPASSRLS, no table privileges, and the
  same 22 function grants as `crm_agent`, name for name
- `agent_capabilities`: RLS on, `postgres` is the only grantee
- `operators_enabled` is now `true`, reason recorded on the row
- a guarded call as `postgres` (exempt) executes and writes no audit row

**Steps 2 to 5 below are still open.** Nothing has been revoked from `crm_agent`
and no password has been set for `agent_sami`.

Two things learned at apply time that the smoke test section needs:

- **`set session authorization` is not available.** On Supabase the `postgres`
  login is not a superuser, so you cannot impersonate `agent_sami` from a
  `postgres` session to exercise the guard. The smoke test genuinely needs a
  `psql` login as the agent role, with its password.
- **`service_role` holds EXECUTE on `agent_require`.** Supabase's default
  privileges for functions created by `postgres` grant execute to
  `service_role`, and the migration only revoked from `public`. This is the
  same state `append_operator_audit_event` has always been in, so it hands
  `service_role` nothing it did not already have, and `service_role` is
  outside this boundary by design. If you want it gone anyway:
  `revoke execute on function public.agent_require(text) from service_role;`

One unrelated finding from the pre-flight: `20260903120000_job_applications`
(the careers backend, PR #33) is not applied in production either, and its
version is now lower than the latest applied one, so `supabase db push` will
skip it unless given `--include-all`.

## Applying the migration

The ordering matters, because Sami connects as `crm_agent` today.

1. **Apply the migration.** Creates the table, the guard, the ten guarded
   functions, the `agent_sami` role, ten enabled rows for **both** `agent_sami` and
   `crm_agent`, and flips `operators_enabled` to true.
2. **Set a password for `agent_sami`** — out of band, never in a migration:
   `alter role agent_sami with password '...';`
3. **Update `.pgpw` and the connection on the Hetzner VPS.** Not in this repo and
   not sequenceable from it.
4. **Confirm Sami still writes** using the smoke test below.
5. **Only then** revoke the functions from `crm_agent` *and delete its capability
   rows in the same step*:
   ```sql
   revoke execute on function public.company_upsert(text,text,text,text,text,jsonb,text,text,jsonb,jsonb) from crm_agent;
   -- ... and the other 21 ...
   delete from public.agent_capabilities where agent_role = 'crm_agent';
   ```

**Between 1 and 3 Sami keeps working on the old role** — but not for the reason you
might assume, and this is the part that is easy to get wrong.

Once this migration lands, **the guard is the gate, not the GRANT list.**
`create or replace` preserves a function's existing ACL, so `crm_agent` keeps every
grant it has. If only `agent_sami` were seeded, `crm_agent` would keep the grants
and lose the ability to use any of them — Sami would stop writing the instant step 1
completed, in exactly the window this ordering exists to protect. That is why
`crm_agent` is seeded too, and why its rows are deleted in the same step that
revokes its grants.

`crm_agent` is seeded rather than added to the guard's exemption list on purpose:
exempting it would leave it permanently ungoverned.

**Two things about step 1 that are behaviour changes, and are meant to be visible:**

- It sets `operators_enabled = true`. The guard consults that switch *before* any
  capability row, and it has read `false` since 2026-08-18 while enforcing nothing.
  Left false, applying this migration would deny every agent write — a total outage,
  not the behaviour-neutral change it is meant to be. Setting it true grants nothing
  new; it records what has been true in practice all along, and it is what makes
  flipping it to false a real control for the first time. **If you want agents off
  at cutover, delete that statement from the migration and know that Sami stops
  writing when it lands.**
- Everything else is behaviour-neutral: all ten capabilities are seeded `true` for
  both roles, reproducing exactly what Sami can do today. Deciding what he *should*
  be able to do is a separate, deliberate change.

## Verify it after applying

The unit suite (`tests/agent-capabilities.test.mjs`) asserts on migration text. It
cannot prove the guard refuses anything. These checks need the database and are run
by hand, once, after applying.

Run these **as `agent_sami`** (or `crm_agent` before the cutover). Running them as
`postgres` proves nothing — `postgres` is exempt and passes straight through.

```sql
-- 1. With the capability enabled: should succeed.
--    Wrapped in a transaction so the smoke test leaves no real referral behind.
begin;
  select public.referral_record(null, null, 'guard smoke test');
rollback;

-- 2. Disable it, retry: expect agent_capability_denied ... capability_disabled
--    (run the update as postgres; the agent cannot write this table)
update public.agent_capabilities set enabled = false
 where agent_role = 'agent_sami' and capability = 'referral_record';

begin;
  select public.referral_record(null, null, 'guard smoke test');  -- expect a raise
rollback;

-- 3. Global switch off: expect operators_disabled from every capability
update public.operator_system_control set operators_enabled = false where id = 'global';

-- 4. As the dashboard does: should still succeed while the switch is off.
--    Run this through the app, not psql — the point is to exercise the
--    authenticator path, which is exempt.

-- Then restore: re-enable the capability and the global switch.
```

`agent_require` is deliberately **not** granted to the agent, so there is no
`select public.agent_require('...')` probe in this list. The `capability_missing`
path is exercised by step 2 with the row deleted instead of disabled, run as the
agent.

### Where denials show up

Not in `operator_audit_events` — see *Who did what* above. After step 2, check the
Postgres log for:

```
agent_capability_denied caller=agent_sami capability=referral_record reason=capability_disabled
```

If that line is absent, the guard is not refusing and something is wrong. Do **not**
verify refusals by querying `operator_audit_events` for `capability_denied`: no such
row is ever written, by design, because it could not survive the rollback.

## Rollback

- One capability: `enabled = true`.
- Everything: `operators_enabled = true`.
- The whole model: the previous function bodies are in
  `docs/operations/operator-control/live-write-functions-2026-09-06.md`, captured
  from production before the guard was added and verified against it by md5.
  Re-applying those drops the guard calls without touching behaviour.
