// The mail tables are reachable ONLY through definer functions, and the two
// halves of the contract go to two different roles: the app reads inboxes and
// can never see a token, the VPS agent writes headers and can never list one.
// A stray grant is invisible in review and total in effect.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260912090000_mail_surface.sql", "utf8");
const statusSql = readFileSync(
  "supabase/migrations/20260912100000_mail_account_status.sql",
  "utf8",
);
const writeSql = readFileSync("supabase/migrations/20260912110000_mail_account_write.sql", "utf8");

/** SQL with `-- ...` comment text removed, so prose about what the code does
 *  NOT do cannot satisfy a doesNotMatch asking about executable SQL. */
const code = (s) => s.replace(/--[^\n]*/g, "");

test("all three tables are created idempotently", () => {
  for (const t of ["mail_accounts", "mail_threads", "mail_messages"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${t}`));
  }
});

test("there is no body column anywhere, under any name", () => {
  // The absence of the column is the enforcement. With nowhere to put a body,
  // nobody adds a cache "just for now".
  //
  // Matching /\bbody\b/ would be useless here: `_` is a word character, so the
  // word boundary never fires at message_body, raw_body or body_html, and the
  // test would pass against the exact column it exists to forbid.
  assert.doesNotMatch(code(sql), /^\s*[a-z_]*body[a-z_]*\s+\w/im);
});

test("RLS is on for every table and no policy is created", () => {
  for (const t of ["mail_accounts", "mail_threads", "mail_messages"]) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
  }
  assert.doesNotMatch(code(sql), /create policy/i);
});

test("the default anon/authenticated grant is revoked, and mail_accounts also loses service_role", () => {
  assert.match(
    sql,
    /revoke all on table public\.mail_threads, public\.mail_messages from anon, authenticated/,
  );
  // service_role has BYPASSRLS, so RLS-with-no-policies does not stop it reading
  // a table directly — only a table-level revoke does. mail_accounts holds the
  // encrypted refresh token, the most dangerous secret in this system, so it
  // must lose the grant that mail_threads/mail_messages (no secret) keep.
  assert.match(
    sql,
    /revoke all on table public\.mail_accounts from anon, authenticated, service_role/,
  );
});

test("no app-facing function can read a token column", () => {
  // The strongest guarantee in this migration. mail_account_for_sync is the
  // only function that touches the ciphertext, and it is agent-only.
  const appFns = ["mail_inbox_list", "mail_threads_for_deal", "mail_threads_for_contact"];
  for (const fn of appFns) {
    const body = sql.slice(sql.indexOf(`function public.${fn}`));
    const end = body.indexOf("$$;");
    assert.doesNotMatch(
      body.slice(0, end),
      /refresh_token_enc|access_token_enc/,
      `${fn} must not read tokens`,
    );
  }
});

test("every agent-half function is granted to both transition roles", () => {
  // Both, not either: agent_sami has no password yet (capability cutover step 2)
  // and Sami connects as crm_agent today. Dropping crm_agent breaks the poller
  // now; dropping agent_sami breaks it at cutover.
  const agentFns = [
    "mail_account_for_sync",
    "mail_sync_upsert_thread",
    "mail_sync_upsert_messages",
    "mail_account_set_history_id",
  ];
  for (const fn of agentFns) {
    const grant = code(sql).match(
      new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\)[^;]*;`),
    );
    assert.ok(grant, `${fn} has no grant at all`);
    assert.match(grant[0], /crm_agent/, `${fn} must be granted to crm_agent`);
    assert.match(grant[0], /agent_sami/, `${fn} must be granted to agent_sami`);
    // The Worker holds the service-role key. mail_account_for_sync returns
    // refresh_token_enc, and the other three let it forge mail rows and move
    // the sync cursor — so service_role must never appear on this grant line.
    assert.doesNotMatch(grant[0], /service_role/, `${fn} must not be granted to service_role`);
  }
});

test("every app-facing function is granted to service_role and nothing else", () => {
  // The browser must never reach these, and neither must the VPS agent: an
  // agent that can list inboxes is outside the contract this migration draws.
  const appFns = ["mail_inbox_list", "mail_threads_for_deal", "mail_threads_for_contact"];
  for (const fn of appFns) {
    const grant = code(sql).match(
      new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\)[^;]*;`),
    );
    assert.ok(grant, `${fn} has no grant at all`);
    assert.match(grant[0], /to service_role;/, `${fn} must be service_role only`);
    assert.doesNotMatch(
      grant[0],
      /anon|authenticated|crm_agent|agent_sami/,
      `${fn} must not reach any other role`,
    );
  }
});

test("every function revokes PUBLIC before granting", () => {
  const revokes = code(sql).match(/revoke all on function/g) ?? [];
  const grants = code(sql).match(/grant execute on function/g) ?? [];
  assert.equal(revokes.length, 7, "one revoke per function");
  assert.equal(grants.length, 7, "one grant per function");
});

test("every definer pins search_path", () => {
  const definers = code(sql).match(/security definer/g) ?? [];
  const paths = code(sql).match(/set search_path = public, pg_temp/g) ?? [];
  assert.equal(definers.length, paths.length);
});

test("the inbox list is bounded", () => {
  assert.match(sql, /least\(coalesce\(p_limit, 50\), 200\)/);
});

test("mail_account_status is app-facing and service_role only", () => {
  assert.match(statusSql, /create or replace function public\.mail_account_status\(\)/);
  assert.match(statusSql, /revoke all on function public\.mail_account_status\(\) from public;/);
  assert.match(
    statusSql,
    /grant execute on function public\.mail_account_status\(\) to service_role;/,
  );
  assert.doesNotMatch(code(statusSql), /crm_agent|agent_sami|anon|authenticated/);
});

test("mail_account_status never selects a token column", () => {
  // It is the one app-facing function that touches mail_accounts, the table
  // holding the ciphertext. Selecting a token here would hand it to the Worker.
  assert.doesNotMatch(code(statusSql), /refresh_token_enc|access_token_enc/);
});

test("mail_account_status pins search_path", () => {
  assert.match(statusSql, /set search_path = public, pg_temp/);
});

test("mail_account_connect and mail_account_set_status exist", () => {
  assert.match(writeSql, /create or replace function public\.mail_account_connect\(/);
  assert.match(writeSql, /create or replace function public\.mail_account_set_status\(/);
});

test("mail_account_connect upserts on the email conflict rather than plain-inserting", () => {
  const body = code(writeSql);
  const start = body.indexOf("function public.mail_account_connect");
  const end = body.indexOf("$$;", start);
  const fnBody = body.slice(start, end);
  // A plain `insert into mail_accounts (...) values (...)` with no conflict
  // clause would fail outright on a reconnect, since email is unique. The
  // conflict target must be the email column specifically — conflicting on
  // some other column (or none) would not protect the one-row-per-mailbox
  // invariant a reconnect depends on.
  assert.match(fnBody, /on conflict\s*\(\s*email\s*\)\s*do update/i);
});

test("mail_account_connect sets status to connected on both insert and reconnect", () => {
  const body = code(writeSql);
  const start = body.indexOf("function public.mail_account_connect");
  const end = body.indexOf("$$;", start);
  const fnBody = body.slice(start, end);

  const valuesMatch = fnBody.match(/values\s*\(([\s\S]*?)\)/);
  assert.ok(valuesMatch, "mail_account_connect must have an insert values list");
  assert.match(
    valuesMatch[1],
    /'connected'/,
    "the inserted row must be created with status connected, not left to a default",
  );

  const updateMatch = fnBody.match(/do update\s+set([\s\S]*?)returning/);
  assert.ok(updateMatch, "mail_account_connect must have an on conflict do update clause");
  assert.match(
    updateMatch[1],
    /status\s*=\s*'connected'/,
    "a reconnect must set status back to connected even if the row was reauth_required or disabled",
  );
});

test("mail_account_connect never touches history_id", () => {
  // The cursor stays valid across a reconnect; clearing it would force a
  // needless backfill. Checked over the whole file, not just this function,
  // so a stray reference anywhere in mail_account_connect or
  // mail_account_set_status is caught.
  assert.doesNotMatch(code(writeSql), /history_id/);
});

test("mail_account_connect refuses a blank email and a blank refresh token", () => {
  const body = code(writeSql);
  const start = body.indexOf("function public.mail_account_connect");
  const end = body.indexOf("$$;", start);
  const fnBody = body.slice(start, end);
  const raises = fnBody.match(/raise exception/g) ?? [];
  assert.ok(
    raises.length >= 2,
    "must raise separately for a blank email and a blank refresh token, not skip either guard",
  );
  assert.match(fnBody, /p_email/, "the email guard must reference p_email");
  assert.match(
    fnBody,
    /p_refresh_token_enc/,
    "the refresh-token guard must reference p_refresh_token_enc",
  );
});

test("mail_account_set_status validates all three status values in the database", () => {
  const body = code(writeSql);
  const start = body.indexOf("function public.mail_account_set_status");
  const end = body.indexOf("$$;", start);
  const fnBody = body.slice(start, end);

  // Anchored on the actual allow-list, not just on any raise anywhere in the
  // function — a check that validated against only one or two of the three
  // values would let a bad string land the row in an impossible status, and a
  // looser regex (e.g. just `/raise exception/`) would not notice that.
  const allowList = fnBody.match(/p_status\s+not in\s*\(([^)]*)\)/i);
  assert.ok(allowList, "mail_account_set_status must validate p_status against an allow-list");
  for (const status of ["connected", "reauth_required", "disabled"]) {
    assert.match(allowList[1], new RegExp(`'${status}'`), `allow-list must include ${status}`);
  }
  assert.match(fnBody, /raise exception/, "an invalid status must raise, not pass through");

  // The other half of the contract: raise if no row matched, same as
  // mail_account_set_history_id.
  assert.match(fnBody, /if not found then/i);
});

test("both write functions are granted to crm_agent and agent_sami, and NOT to service_role, anon, or authenticated", () => {
  // This is the important one. The Worker holds no encryption key and could
  // only ever write a garbage token through mail_account_connect, and it has
  // no legitimate reason to flip a mailbox's status — so service_role must be
  // absent here even though it is granted on every other function in this
  // schema. A regex that only checked for crm_agent/agent_sami presence would
  // pass even if someone "fixed" this by adding service_role back in; the
  // doesNotMatch clause is what actually polices that.
  const fnNames = ["mail_account_connect", "mail_account_set_status"];
  for (const name of fnNames) {
    // Both the create and the revoke must exist for this function, so the
    // grant match below is provably about a real, guarded function and not a
    // typo that happens to match nothing.
    assert.match(code(writeSql), new RegExp(`create or replace function public\\.${name}\\(`));
    assert.match(
      code(writeSql),
      new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public;`),
    );

    const grant = code(writeSql).match(
      new RegExp(`grant execute on function public\\.${name}\\([^)]*\\)[^;]*;`),
    );
    assert.ok(grant, `${name} has no grant at all`);
    assert.match(grant[0], /crm_agent/, `${name} must be granted to crm_agent`);
    assert.match(grant[0], /agent_sami/, `${name} must be granted to agent_sami`);
    assert.doesNotMatch(
      grant[0],
      /service_role|anon|authenticated/,
      `${name} must not be granted to service_role, anon, or authenticated`,
    );
  }
});

test("both write functions revoke PUBLIC before granting", () => {
  const revokes = code(writeSql).match(/revoke all on function/g) ?? [];
  const grants = code(writeSql).match(/grant execute on function/g) ?? [];
  assert.equal(revokes.length, 2, "one revoke per function");
  assert.equal(grants.length, 2, "one grant per function");
});

test("both write functions pin search_path and are security definer", () => {
  const definers = code(writeSql).match(/security definer/g) ?? [];
  const paths = code(writeSql).match(/set search_path = public, pg_temp/g) ?? [];
  assert.equal(definers.length, 2);
  assert.equal(paths.length, 2);
  assert.equal(definers.length, paths.length);
});
