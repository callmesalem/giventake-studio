// The mail tables are reachable ONLY through definer functions, and the two
// halves of the contract go to two different roles: the app reads inboxes and
// can never see a token, the VPS agent writes headers and can never list one.
// A stray grant is invisible in review and total in effect.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260912090000_mail_surface.sql", "utf8");

/** SQL with `-- ...` comment text removed, so prose about what the code does
 *  NOT do cannot satisfy a doesNotMatch asking about executable SQL. */
const code = (s) => s.replace(/--[^\n]*/g, "");

test("all three tables are created idempotently", () => {
  for (const t of ["mail_accounts", "mail_threads", "mail_messages"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${t}`));
  }
});

test("there is no body column anywhere", () => {
  // The absence of the column is the enforcement. With nowhere to put a body,
  // nobody adds a cache "just for now".
  assert.doesNotMatch(code(sql), /\bbody\b/);
});

test("RLS is on for every table and no policy is created", () => {
  for (const t of ["mail_accounts", "mail_threads", "mail_messages"]) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
  }
  assert.doesNotMatch(code(sql), /create policy/i);
});

test("the default anon/authenticated grant is revoked", () => {
  assert.match(sql, /revoke all on table public\.mail_accounts, public\.mail_threads, public\.mail_messages from anon, authenticated/);
});

test("no app-facing function can read a token column", () => {
  // The strongest guarantee in this migration. mail_account_for_sync is the
  // only function that touches the ciphertext, and it is agent-only.
  const appFns = ["mail_inbox_list", "mail_threads_for_deal", "mail_threads_for_contact"];
  for (const fn of appFns) {
    const body = sql.slice(sql.indexOf(`function public.${fn}`));
    const end = body.indexOf("$$;");
    assert.doesNotMatch(body.slice(0, end), /refresh_token_enc|access_token_enc/, `${fn} must not read tokens`);
  }
});

test("the sync functions are granted to agent_sami, not only crm_agent", () => {
  // agent-capabilities.md:165 retires crm_agent. Granting to it alone breaks
  // mail at cutover, which is the mistake the demo_sites migration made.
  for (const fn of ["mail_account_for_sync", "mail_account_set_history_id"]) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}[^;]*to [^;]*agent_sami`));
  }
});

test("app functions are granted to service_role only", () => {
  assert.match(sql, /grant execute on function public\.mail_inbox_list\(integer, integer\) to service_role;/);
  assert.doesNotMatch(code(sql), /mail_inbox_list[^;]*to (anon|authenticated|agent_sami)/);
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
