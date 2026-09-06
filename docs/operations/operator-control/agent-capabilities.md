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

So: **anything holding the service-role key is outside this boundary.** That key
already bypasses RLS, so it was never inside it. What matters is that Sami holds a
Postgres password for his own role and not that key.

## Turn one capability off

```sql
update public.agent_capabilities
   set enabled = false, updated_at = now(), updated_by = 'salem'
 where agent_role = 'agent_sami'
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

Both outcomes land in `public.operator_audit_events`:

```sql
select created_at, operator_key, event_type, details
  from public.operator_audit_events
 where event_type in ('capability_allowed', 'capability_denied')
 order by created_at desc
 limit 50;
```

`operator_key` is the agent role, `details` carries `{capability, reason}`. The
table is append-only — `operator_audit_no_update_delete` blocks UPDATE and DELETE —
so an agent cannot erase its own trail.

Allows are recorded as well as denials. Denials matter most, but the allows are
what answer *what did Sami change last Tuesday*.

## Applying the migration

The ordering matters, because Sami connects as `crm_agent` today.

1. **Apply the migration.** Creates the table, the guard, the ten guarded
   functions, the `agent_sami` role, and its ten enabled rows.
2. **Set a password for `agent_sami`** — out of band, never in a migration:
   `alter role agent_sami with password '...';`
3. **Update `.pgpw` and the connection on the Hetzner VPS.** Not in this repo and
   not sequenceable from it.
4. **Confirm Sami still writes** using the smoke test below.
5. **Only then** revoke the functions from `crm_agent`.

**Between 1 and 3 Sami keeps working on the old role**, because `crm_agent` retains
its grants until step 5. That is deliberate — an agent cut off mid-task is worse
than one briefly holding two paths.

Step 1 is behaviour-neutral by design: all ten capabilities are seeded `true`,
reproducing exactly what Sami can do today. Deciding what he *should* be able to do
is a separate, deliberate change.

## Verify it after applying

The unit suite (`tests/agent-capabilities.test.mjs`) asserts on migration text. It
cannot prove the guard refuses anything. These checks need the database and are run
by hand, once, after applying.

```sql
-- 1. As agent_sami, with the capability enabled: should succeed.
select public.referral_record(null, null, 'guard smoke test');

-- 2. Disable it, retry: expect agent_capability_denied ... capability_disabled
update public.agent_capabilities set enabled = false
 where agent_role = 'agent_sami' and capability = 'referral_record';

-- 3. A capability with no row at all: expect capability_missing
select public.agent_require('not_a_real_capability');

-- 4. Global switch off: expect operators_disabled from every capability
update public.operator_system_control set operators_enabled = false where id = 'global';

-- 5. As the dashboard does (service_role via PostgREST): should still succeed.
--    Run this one through the app, not psql — the point is to exercise the
--    authenticator path.

-- Then restore: re-enable the capability and the global switch.
```

### One question the database has to answer

The guard writes its audit row **before** raising, and the raise rolls the
transaction back — so **a denial may not survive**. Confirm this after applying:

```sql
select count(*) from public.operator_audit_events where event_type = 'capability_denied';
```

Trigger a denial (step 2 above), then re-run. If the count does not move, denials
are being rolled back and the fix is to write them from an autonomous transaction
(`pg_background`, or a `dblink` loopback). That is a change worth making
deliberately rather than assuming — record the answer here either way.

Allows are unaffected: they commit with the write they authorised.

## Rollback

- One capability: `enabled = true`.
- Everything: `operators_enabled = true`.
- The whole model: the previous function bodies are in
  `docs/operations/operator-control/live-write-functions-2026-09-06.md`, captured
  from production before the guard was added and verified against it by md5.
  Re-applying those drops the guard calls without touching behaviour.
