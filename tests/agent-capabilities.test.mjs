import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raw = readFileSync(
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

// Every function crm_agent holds EXECUTE on, as type-only signatures. Derived from
// pg_proc + aclexplode on 2026-09-06. The suite COMPARES against this rather than
// counting, so swapping one entry for a privileged function is caught.
const GRANTED = [
  "activity_snapshot()",
  "approval_queue_list(text)",
  "approval_request(text,text,text,text,text,jsonb,text,timestamptz)",
  "attribution_snapshot()",
  "check_operator_control(text,operator_mode)",
  "company_upsert(text,text,text,text,text,jsonb,text,text,jsonb,jsonb)",
  "contact_upsert(text,text,uuid,text,text,text,text,jsonb,jsonb)",
  "deal_advance_stage(uuid,text,text,text)",
  "deal_upsert(text,text,uuid,text,text,numeric,jsonb)",
  "is_approved_recipient(text,text)",
  "leads_list(integer)",
  "note_upsert(text,text,uuid,text,text,jsonb,uuid)",
  "operator_get_controls(text)",
  "operator_get_system_control()",
  "operator_is_suppressed(text)",
  "pipeline_stages_list()",
  "prospecting_snapshot()",
  "referral_partner_upsert(uuid,text,text,text,text)",
  "referral_record(uuid,uuid,text)",
  "referral_set_status(uuid,text)",
  "referral_snapshot()",
  "task_upsert(text,text,uuid,text,boolean,timestamptz,jsonb)",
];

/**
 * Strip `--` comments, respecting single-quoted strings.
 *
 * This exists because of a measured failure: with assertions run against the raw
 * file, commenting out EVERY line of the migration — so that it creates nothing at
 * all — left 29 of 30 tests passing. A `--` line satisfies `assert.match` just as
 * well as executable SQL does. Everything below asserts on `code`, never `raw`.
 *
 * Comments inside dollar-quoted bodies are stripped too, deliberately: plpgsql uses
 * the same `--` syntax, and the guard's own body is heavily commented. Leaving them
 * in let the comment "SET ROLE does not change session_user" satisfy the assertion
 * that the guard READS session_user.
 */
function stripSqlComments(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === "--") {
      const nl = text.indexOf("\n", i);
      i = nl === -1 ? text.length : nl;
      continue;
    }
    if (text[i] === "'") {
      const start = i;
      i += 1;
      while (i < text.length) {
        if (text[i] === "'" && text[i + 1] === "'") i += 2;
        else if (text[i] === "'") { i += 1; break; }
        else i += 1;
      }
      out += text.slice(start, i);
      continue;
    }
    out += text[i];
    i += 1;
  }
  return out;
}

const code = stripSqlComments(raw);

test("comment stripping actually removed the commentary", () => {
  // 124 of the migration's 480 lines are commentary. If the stripper stopped
  // working, every assertion below would silently become satisfiable by prose.
  const commentLines = raw.split("\n").filter((l) => l.trim().startsWith("--")).length;
  assert.ok(commentLines > 50, `expected a heavily commented migration, saw ${commentLines}`);
  assert.equal(
    code.split("\n").filter((l) => l.trim().startsWith("--")).length,
    0,
    "comment lines survived stripping",
  );
  assert.doesNotMatch(
    code.replace(/\$\$[\s\S]*?\$\$/g, ""),
    /--/,
    "a comment survived stripping outside a dollar-quoted body",
  );
  // And it must not have eaten the executable statements.
  assert.match(code, /create table if not exists public\.agent_capabilities/);
  assert.match(code, /create or replace function public\.agent_require\(p_capability text\)/);
});

// The guard's own body. Anchored on the FULL signature, because a prefix match
// would also bind to a decoy such as `agent_require_legacy` defined above it, and
// every guard assertion would then be evaluating the decoy.
function guardBody() {
  const sig = "create or replace function public.agent_require(p_capability text)";
  const start = code.indexOf(sig);
  assert.notEqual(start, -1, "agent_require is not defined in the migration");
  assert.equal(
    code.indexOf(sig, start + 1),
    -1,
    "agent_require is defined more than once; the later definition silently wins",
  );
  const end = code.indexOf("end $$;", start);
  assert.notEqual(end, -1, "agent_require has no terminator");
  return code.slice(start, end);
}

test("only one function is named agent_require", () => {
  const defs = code.match(/create or replace function public\.agent_require\w*/g) ?? [];
  assert.deepEqual(
    defs,
    ["create or replace function public.agent_require"],
    "a near-named decoy (agent_require_legacy, agent_require_v2) would let the " +
      "real guard be gutted while every assertion here passes",
  );
});

// ---------------------------------------------------------------------------
// The capability table
// ---------------------------------------------------------------------------

test("the capability table is created idempotently", () => {
  assert.match(code, /create table if not exists public\.agent_capabilities/);
});

test("a capability is keyed by agent and function together", () => {
  assert.match(code, /primary key \(agent_role, capability\)/);
});

test("a capability is disabled unless switched on", () => {
  assert.match(code, /enabled\s+boolean\s+not null\s+default false/);
});

test("the table records who changed it and when", () => {
  assert.match(code, /updated_at\s+timestamptz/);
  assert.match(code, /updated_by\s+text/);
});

test("row level security is enabled on the capability table", () => {
  assert.match(code, /alter table public\.agent_capabilities enable row level security/);
});

test("the capability table is out of reach of anon, authenticated and service_role", () => {
  assert.match(
    code,
    /revoke all on table public\.agent_capabilities from anon, authenticated, service_role/,
    "Supabase default privileges grant service_role arwdDxtm on new public tables " +
      "and it holds BYPASSRLS, so without this the control table is a writable " +
      "PostgREST endpoint with no append-only trigger",
  );
});

test("nothing hands privileges back after the revoke", () => {
  const after = code.slice(code.indexOf("revoke all on table public.agent_capabilities"));
  assert.doesNotMatch(
    after,
    /grant[^;]*on\s+(table\s+)?public\.agent_capabilities/i,
    "a grant after the revoke undoes it",
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
  assert.match(
    body,
    /v_caller\s+text\s*:=\s*session_user;/,
    "the caller must come from session_user itself, not a literal or a setting " +
      "the caller can choose",
  );
  assert.doesNotMatch(
    body,
    /current_user/,
    "these functions are SECURITY DEFINER owned by postgres, so current_user is " +
      "postgres for every caller — a guard on it allows or denies everything",
  );
});

test("the guard consults the kill switch before any capability row", () => {
  const body = guardBody();
  const killIdx = body.indexOf("operator_system_control");
  const lookupIdx = body.indexOf("from public.agent_capabilities");
  assert.ok(killIdx > -1, "the guard never reads the kill switch");
  assert.ok(lookupIdx > -1, "the guard never reads the capability table");
  assert.ok(killIdx < lookupIdx, "one flip must stop every agent first");
});

test("a missing control row denies rather than opening", () => {
  assert.match(
    guardBody(),
    /coalesce\(v_global, false\) is not true/,
    "`v_global is false` would treat a missing control row as permission",
  );
});

test("the capability lookup is keyed to the calling agent", () => {
  assert.match(
    guardBody(),
    /where agent_role = v_caller and capability = p_capability/,
    "without agent_role in the predicate, any agent's row satisfies any other " +
      "agent's call",
  );
});

test("each refusal has its own reason", () => {
  const body = guardBody();
  for (const reason of ["operators_disabled", "capability_missing", "capability_disabled"]) {
    assert.match(body, new RegExp(`'${reason}'`));
  }
});

test("the guard actually refuses", () => {
  assert.match(
    guardBody(),
    /raise exception 'agent_capability_denied/,
    "computing a reason and logging it is not refusing; without a raise every " +
      "call proceeds",
  );
});

test("an allowed call is recorded in the audit table", () => {
  const body = guardBody();
  assert.match(body, /insert into public\.operator_audit_events/);
  assert.match(body, /'capability_allowed'/);
});

// A denial cannot be recorded in operator_audit_events: raising aborts the
// transaction and takes the row with it. An insert above the raise would look like
// an audit trail and always roll back, which is worse than none — an operator
// would search for denials, find zero, and conclude nothing had been refused.
test("a denial is NOT written to the audit table, because it would roll back", () => {
  assert.doesNotMatch(
    guardBody(),
    /'capability_denied'/,
    "inserting a denial row before the raise is dead code that always rolls back",
  );
});

test("a denial goes to the server log, which survives the rollback", () => {
  const body = guardBody();
  const warnIdx = body.indexOf("raise warning");
  const raiseIdx = body.indexOf("raise exception");
  assert.ok(warnIdx > -1, "no durable record of the refusal is emitted");
  assert.ok(warnIdx < raiseIdx, "the warning must precede the aborting exception");
});

test("the guard is not callable by public", () => {
  assert.match(code, /revoke all on function public\.agent_require\(text\) from public/);
});

// The dashboard reaches these same functions through PostgREST, which logs in as
// `authenticator` and SET ROLEs to service_role. SET ROLE does not change
// session_user, so every dashboard write arrives at the guard as `authenticator`.
test("the app's PostgREST role passes through, or the whole dashboard breaks", () => {
  assert.match(guardBody(), /'authenticator'/);
});

test("the pass-through is a closed list, not a name pattern", () => {
  const body = guardBody();
  assert.match(
    body,
    /v_caller in \('authenticator', 'postgres', 'supabase_admin', 'cli_login_postgres'\)/,
  );
  // Any of these spellings would decide agent-ness by name, which fails OPEN for
  // every role that does not match.
  for (const openShape of [/like\s+'agent/i, /!~/, /~\s*'\^agent/i, /starts_with/i, /left\(v_caller/i]) {
    assert.doesNotMatch(body, openShape, "agent-ness must not be decided by name shape");
  }
});

// ---------------------------------------------------------------------------
// The guarded write functions
// ---------------------------------------------------------------------------

// Span of one function definition: signature through its terminator.
function functionText(fn) {
  const start = code.indexOf(`create or replace function public.${fn}(`);
  assert.notEqual(start, -1, `${fn} is not in the migration`);
  const end = code.indexOf("end $$;", start);
  assert.notEqual(end, -1, `${fn} has no terminator`);
  return code.slice(start, end + "end $$;".length);
}

test("every write function is re-created", () => {
  for (const fn of WRITES) functionText(fn);
});

test("every write function keeps definer rights and a pinned search_path", () => {
  for (const fn of WRITES) {
    const t = functionText(fn);
    assert.match(t, /security definer/, `${fn} lost security definer`);
    assert.match(t, /set search_path = public, pg_temp/, `${fn} lost its search_path`);
  }
});

// Placement is the whole point. Moving the call after the write it gates — or
// after a `return` — leaves it unreachable while the file still contains all ten
// calls, which a whole-file match cannot tell apart.
test("the guard is the FIRST statement of every write function", () => {
  for (const fn of WRITES) {
    const t = functionText(fn);
    const beginIdx = t.search(/\bbegin\b/);
    assert.notEqual(beginIdx, -1, `${fn} has no begin`);
    const firstStatement = t.slice(beginIdx + "begin".length).trim();
    assert.ok(
      firstStatement.startsWith(`perform public.agent_require('${fn}');`),
      `${fn} does not call the guard first — it starts with: ` +
        `${firstStatement.slice(0, 80)}`,
    );
  }
});

test("exactly ten call sites exist — no more, no fewer", () => {
  const calls = code.match(/agent_require[(]'[^']*'[)]/g) ?? [];
  assert.equal(calls.length, WRITES.length, `found: ${calls.join(", ")}`);
  assert.deepEqual(
    [...new Set(calls)].sort(),
    WRITES.map((f) => `agent_require('${f}')`).sort(),
  );
});

// `create or replace` with a different argument list does not replace anything —
// it creates an OVERLOAD, and the original unguarded function stays callable. So
// each signature must match production exactly.
test("every signature matches production, so nothing becomes an overload", () => {
  const canon = (s) =>
    s
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/timestamp with time zone/g, "timestamptz")
      .replace(/::uuid/g, "")
      .replace(/\s*,\s*/g, ",");

  const producedSig = (text, fn) => {
    const open = text.indexOf(`(`, text.indexOf(`function public.${fn}(`));
    let depth = 0;
    for (let i = open; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") {
        depth--;
        if (depth === 0) return text.slice(open + 1, i);
      }
    }
    throw new Error(`unbalanced parens in ${fn}`);
  };

  for (const fn of WRITES) {
    const live = /CREATE OR REPLACE FUNCTION public\.\w+\(/.test(capture)
      ? producedSig(
          capture.slice(capture.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`)),
          fn,
        )
      : null;
    assert.ok(live, `no captured signature for ${fn}`);
    assert.equal(
      canon(producedSig(functionText(fn), fn)),
      canon(live),
      `${fn}'s argument list differs from production — create or replace would ` +
        `add an overload and leave the unguarded original callable`,
    );
  }
});

test("note_upsert keeps its default, so six-argument callers still work", () => {
  assert.match(functionText("note_upsert"), /p_lead_id uuid default null\)/i);
});

// The strongest assertion here: adding the guard must be the ONLY change to each
// function. Bodies are compared against the definitions captured from production.
test("the guard is the only change — every body still matches production", () => {
  const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();

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
  assert.equal(Object.keys(captured).length, WRITES.length);

  for (const fn of WRITES) {
    const t = functionText(fn);
    const open = t.indexOf("as $$");
    const close = t.indexOf("end $$;", open);
    const withGuard = t.slice(open + "as $$".length, close) + "end";
    const withoutGuard = withGuard.replace(
      new RegExp(`\\s*perform public\\.agent_require\\('${fn}'\\);`),
      "",
    );
    assert.equal(
      norm(withoutGuard),
      norm(captured[fn]),
      `${fn}'s body changed beyond adding the guard`,
    );
  }
});

// ---------------------------------------------------------------------------
// Sami's role and seed state
// ---------------------------------------------------------------------------

test("the agent role is created without elevated attributes", () => {
  assert.match(code, /create role agent_sami login noinherit;/);
  for (const bad of [/bypassrls/i, /superuser/i, /createrole/i, /createdb/i, /replication/i]) {
    assert.doesNotMatch(code, bad, "the agent role must stay unprivileged");
  }
});

test("role creation is idempotent", () => {
  assert.match(code, /if not exists \(select 1 from pg_roles where rolname = 'agent_sami'\)/);
});

test("agent_sami receives only schema usage and function execute", () => {
  const fragments = code.split(";").filter((f) => /to\s+agent_sami\s*$/.test(f.trim()));
  assert.ok(fragments.length >= 2, "expected the usage grant and the execute grant");
  for (const f of fragments) {
    const ok =
      /grant usage on schema public\s+to\s+agent_sami\s*$/i.test(f.trim()) ||
      /grant execute on function/i.test(f);
    assert.ok(ok, `unexpected grant to agent_sami: ${f.trim().slice(0, 140)}`);
  }
  for (const bad of [/pg_read_all_data/i, /pg_write_all_data/i, /all privileges/i]) {
    assert.doesNotMatch(code, bad);
  }
});

test("the guard itself is not granted to the agent", () => {
  assert.doesNotMatch(
    code,
    /grant execute on function public\.agent_require\(text\) to agent_sami/,
    "a direct call takes an arbitrary capability string and writes an audit row " +
      "that UPDATE/DELETE cannot remove — an audit-forgery primitive",
  );
});

test("the granted function list is exactly the 22 crm_agent holds", () => {
  const start = code.indexOf("grant execute on function\n");
  assert.notEqual(start, -1, "the bulk grant block is missing or reformatted");
  const listed = code.slice(start, code.indexOf("to agent_sami", start));
  const found = (listed.match(/public\.\w+\([^)]*\)/g) ?? []).map((s) =>
    s.replace(/^public\./, "").replace(/\s+/g, ""),
  );
  assert.deepEqual(
    found.sort(),
    [...GRANTED].sort(),
    "the grant list is a security boundary — a swap for a privileged function " +
      "keeps the count at 22 and must still fail",
  );
});

// Sami connects as crm_agent TODAY. The moment this lands, the guard — not the
// GRANT list — is the gate, and create-or-replace preserves the ACL. Seeding only
// agent_sami would cut him off instantly, in the very live window the deploy order
// exists to protect.
test("crm_agent is seeded too, or Sami stops writing the moment this applies", () => {
  for (const fn of WRITES) {
    assert.match(
      code,
      new RegExp(`\\('crm_agent',\\s*'${fn}',\\s*true`),
      `crm_agent has no row for ${fn}, so Sami's current role would be denied`,
    );
  }
});

test("crm_agent is seeded, NOT exempted from the guard", () => {
  assert.doesNotMatch(
    guardBody(),
    /crm_agent/,
    "exempting crm_agent would leave it permanently ungoverned",
  );
});

test("all ten capabilities are seeded enabled for agent_sami", () => {
  for (const fn of WRITES) {
    assert.match(code, new RegExp(`\\('agent_sami',\\s*'${fn}',\\s*true`));
  }
});

test("only the two intended roles are seeded", () => {
  const roles = new Set(
    (code.match(/\('(agent_\w+|crm_\w+)',\s*'\w+',\s*true/g) ?? []).map(
      (m) => /\('([^']+)'/.exec(m)[1],
    ),
  );
  assert.deepEqual([...roles].sort(), ["agent_sami", "crm_agent"]);
});

test("the seed targets the capability table and its real columns", () => {
  assert.match(
    code,
    /insert into public\.agent_capabilities\(agent_role, capability, enabled, updated_by\)/,
  );
});

test("seeding is idempotent", () => {
  assert.match(code, /on conflict \(agent_role, capability\) do nothing/);
});

// The guard reads this switch before any capability row, and it has read false
// since 2026-08-18 while enforcing nothing. Applying without addressing it makes
// the migration a total outage instead of the behaviour-neutral change it claims.
test("the global switch is addressed, or every seeded row is unreachable", () => {
  assert.match(code, /update public\.operator_system_control/);
  assert.match(code, /set operators_enabled = true/);
});
