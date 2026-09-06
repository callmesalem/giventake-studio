import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "supabase/migrations/20260906120000_agent_capabilities.sql",
  "utf8",
);

const capture = readFileSync(
  "docs/operations/operator-control/live-write-functions-2026-09-06.md",
  "utf8",
);

const WRITES = [
  "approval_request",
  "company_upsert",
  "contact_upsert",
  "deal_advance_stage",
  "deal_upsert",
  "note_upsert",
  "referral_partner_upsert",
  "referral_record",
  "referral_set_status",
  "task_upsert",
];

// The guard's own body. Every assertion about the guard reads this, not the whole
// file — the file also holds ten pasted production bodies and a header comment,
// and an assertion that matches those instead is one that passes for the wrong
// reason.
function guardBody() {
  const start = sql.indexOf("create or replace function public.agent_require");
  assert.notEqual(start, -1, "agent_require is not defined in the migration");
  const end = sql.indexOf("comment on function public.agent_require", start);
  assert.notEqual(end, -1, "agent_require has no comment marking its end");
  return sql.slice(start, end);
}

// ---------------------------------------------------------------------------
// The capability table
// ---------------------------------------------------------------------------

test("the capability table is created idempotently", () => {
  assert.match(sql, /create table if not exists public\.agent_capabilities/);
});

test("a capability is keyed by agent and function together", () => {
  assert.match(sql, /primary key \(agent_role, capability\)/);
});

test("a capability is disabled unless switched on", () => {
  assert.match(sql, /enabled\s+boolean\s+not null\s+default false/);
});

test("the table records who changed it and when", () => {
  assert.match(sql, /updated_at\s+timestamptz/);
  assert.match(sql, /updated_by\s+text/);
});

test("the table is not reachable by anon or authenticated", () => {
  assert.match(
    sql,
    /revoke all on table public\.agent_capabilities from anon, authenticated/,
  );
});

// ---------------------------------------------------------------------------
// The guard
// ---------------------------------------------------------------------------

test("the guard is a definer function with a pinned search_path", () => {
  assert.match(guardBody(), /security definer/);
  assert.match(guardBody(), /set search_path = public, pg_temp/);
});

test("the guard reads session_user, NOT current_user", () => {
  const body = guardBody();
  assert.match(body, /session_user/);
  assert.doesNotMatch(
    body,
    /current_user/,
    "the write functions are SECURITY DEFINER owned by postgres, so current_user " +
      "inside them is postgres for every caller — a guard on it allows everything " +
      "or denies everything, and looks correct in review",
  );
});

test("the global kill switch is checked before the per-capability lookup", () => {
  const body = guardBody();
  const killIdx = body.indexOf("operator_system_control");
  const lookupIdx = body.indexOf("from public.agent_capabilities");
  assert.ok(killIdx > -1, "the guard never reads the kill switch");
  assert.ok(lookupIdx > -1, "the guard never reads the capability table");
  assert.ok(
    killIdx < lookupIdx,
    "one flip must stop every agent before any capability row is considered",
  );
});

test("each refusal has its own reason", () => {
  const body = guardBody();
  for (const reason of [
    "operators_disabled",
    "capability_missing",
    "capability_disabled",
  ]) {
    assert.match(body, new RegExp(reason));
  }
});

test("the guard audits both outcomes, not only denials", () => {
  const body = guardBody();
  assert.match(body, /capability_allowed/);
  assert.match(body, /capability_denied/);
  assert.match(body, /insert into public\.operator_audit_events/);
});

test("the guard is not callable by public", () => {
  assert.match(sql, /revoke all on function public\.agent_require\(text\) from public/);
});

// The dashboard reaches these same functions through PostgREST, which logs in as
// `authenticator` and SET ROLEs to service_role. SET ROLE does not change
// session_user, so every dashboard write arrives at the guard as `authenticator`.
// Without the exemption the guard refuses every write in the CRM UI.
test("the app's PostgREST role passes through, or the whole dashboard breaks", () => {
  assert.match(
    guardBody(),
    /'authenticator'/,
    "PostgREST logs in as authenticator; without an exemption every dashboard " +
      "write raises capability_missing",
  );
});

test("the pass-through is a closed list, not a name pattern", () => {
  const body = guardBody();
  assert.match(body, /v_caller in \('authenticator', 'postgres', 'supabase_admin'\)/);
  assert.doesNotMatch(
    body,
    /like\s+'agent/i,
    "matching agent roles by name prefix fails OPEN for any role that does not " +
      "match — a new connecting role would be unguarded rather than denied",
  );
});

// ---------------------------------------------------------------------------
// The guarded write functions
// ---------------------------------------------------------------------------

test("every write function is re-created", () => {
  for (const fn of WRITES) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\(`));
  }
});

test("every write function calls the guard with its own name", () => {
  for (const fn of WRITES) {
    assert.match(
      sql,
      new RegExp(`agent_require\\('${fn}'\\)`),
      `${fn} must guard on its own capability name, not another's`,
    );
  }
});

test("exactly ten call sites exist — no more, no fewer", () => {
  const calls = sql.match(/agent_require[(]'[a-z_]+'[)]/g) ?? [];
  assert.equal(
    calls.length,
    WRITES.length,
    `found ${calls.length} guard calls: ${calls.join(", ")}`,
  );
  assert.deepEqual(
    [...new Set(calls)].sort(),
    WRITES.map((f) => `agent_require('${f}')`).sort(),
    "a guard call naming something outside the ten writes is either a typo or a " +
      "read function that should not be gated",
  );
});

test("note_upsert keeps its default, so six-argument callers still work", () => {
  assert.match(sql, /p_lead_id uuid default null/i);
});

// The strongest assertion here. Adding the guard must be the ONLY change to each
// function: the bodies are compared against the definitions captured from
// production, with the guard line removed.
test("the guard is the only change — every body still matches production", () => {
  const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();

  // Bodies as captured from production.
  const captured = {};
  for (const block of capture.split("```sql").slice(1)) {
    const body = block.slice(0, block.indexOf("```"));
    const name = /CREATE OR REPLACE FUNCTION public\.(\w+)\(/.exec(body);
    if (!name) continue;
    const open = body.indexOf("AS $function$");
    const close = body.lastIndexOf("$function$");
    if (open === -1 || close <= open) continue;
    captured[name[1]] = body.slice(open + "AS $function$".length, close);
  }
  assert.equal(
    Object.keys(captured).length,
    WRITES.length,
    "the capture doc should hold one definition per write function",
  );

  for (const fn of WRITES) {
    const decl = sql.indexOf(`create or replace function public.${fn}(`);
    assert.notEqual(decl, -1, `${fn} is not in the migration`);
    const open = sql.indexOf("as $$", decl);
    const close = sql.indexOf("end $$;", open);
    assert.ok(open > -1 && close > open, `cannot read ${fn}'s body`);

    const withGuard = sql.slice(open + "as $$".length, close) + "end";
    const withoutGuard = withGuard.replace(
      new RegExp(`\\s*perform public\\.agent_require\\('${fn}'\\);`),
      "",
    );

    assert.equal(
      norm(withoutGuard),
      norm(captured[fn]),
      `${fn}'s body changed beyond adding the guard — re-creating a production ` +
        `function is not the place to edit it`,
    );
  }
});

// ---------------------------------------------------------------------------
// Sami's role and seed state
// ---------------------------------------------------------------------------

test("the agent role is created without table access or RLS bypass", () => {
  assert.match(sql, /create role agent_sami/);
  assert.doesNotMatch(sql, /agent_sami[^;]*bypassrls/i);
  assert.doesNotMatch(sql, /grant[^;]*on table[^;]*to agent_sami/i);
});

test("role creation is idempotent", () => {
  assert.match(sql, /if not exists \(select 1 from pg_roles where rolname = 'agent_sami'\)/);
});

test("all ten capabilities are seeded enabled, reproducing today's behaviour", () => {
  for (const fn of WRITES) {
    assert.match(
      sql,
      new RegExp(`\\('agent_sami',\\s*'${fn}',\\s*true`),
      `${fn} is not seeded, so it would deny on day one — that is a behaviour ` +
        `change hidden inside an infrastructure change`,
    );
  }
});

test("seeding is idempotent", () => {
  assert.match(sql, /on conflict \(agent_role, capability\) do nothing/);
});

test("agent_sami is granted the same 22 functions crm_agent holds", () => {
  const grant = sql.slice(sql.indexOf("grant execute on function\n"));
  const listed = grant.slice(0, grant.indexOf("to agent_sami"));
  const count = (listed.match(/public\.\w+\(/g) ?? []).length;
  assert.equal(count, 22, `expected 22 granted functions, found ${count}`);
});
