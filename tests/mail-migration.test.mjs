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

test("the default anon/authenticated grant is revoked", () => {
  assert.match(
    sql,
    /revoke all on table public\.mail_accounts, public\.mail_threads, public\.mail_messages from anon, authenticated/,
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
