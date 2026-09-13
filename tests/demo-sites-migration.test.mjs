// demo_sites is reachable ONLY through SECURITY DEFINER functions, and the two
// halves of its contract go to two different roles: the app queues work as
// service_role, the VPS agent polls and reports as crm_agent. These tests are
// the record of that split, because a stray grant is invisible in review and
// total in effect.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260911223000_demo_sites.sql", "utf8");
const logSql = readFileSync(
  "supabase/migrations/20260911230000_demo_site_request_logging.sql",
  "utf8",
);

/** SQL with `-- ...` comment text removed.
 *
 *  Needed because these migrations explain themselves at length, and prose
 *  about a value the code deliberately does NOT write ("outcome is
 *  'demo_site_queued' and not 'demo_site_built'") would otherwise satisfy a
 *  doesNotMatch that is asking about executable SQL. */
const code = (source) => source.replace(/--[^\n]*/g, "");

test("the table is created idempotently", () => {
  assert.match(sql, /create table if not exists public\.demo_sites/);
});

test("a demo must be attached to a company or a deal", () => {
  // A demo attached to neither belongs to nothing and can never be surfaced.
  assert.match(sql, /check \(company_id is not null or deal_id is not null\)/);
});

test("status is constrained in the database, not just in TypeScript", () => {
  assert.match(
    sql,
    /check \(status in \('requested', 'building', 'live', 'failed', 'archived'\)\)/,
  );
});

test("RLS is on and no policy is ever created", () => {
  assert.match(sql, /alter table public\.demo_sites enable row level security/);
  // RLS with no policies denies every row; a policy appearing here would be a
  // direct-access path that bypasses the definer functions entirely.
  assert.doesNotMatch(code(sql), /create policy/i);
});

test("the default anon/authenticated grant is revoked", () => {
  // RLS denies the rows, but the default ACL grant must go too — matching every
  // sibling migration. Without this the table is 'reachable but empty', which
  // reads as a bug rather than a boundary.
  assert.match(sql, /revoke all on table public\.demo_sites from anon, authenticated/);
});

// --- the two halves of the contract ----------------------------------------

test("app-facing functions are granted to service_role ONLY", () => {
  for (const fn of [
    /grant execute on function public\.demo_site_request\([^)]*\) to service_role;/,
    /grant execute on function public\.demo_sites_for_deal\(uuid\) to service_role;/,
    /grant execute on function public\.demo_sites_for_company\(uuid\) to service_role;/,
  ]) {
    assert.match(sql, fn);
  }
  // The browser must never be able to queue a public deployment directly.
  assert.doesNotMatch(code(sql), /demo_site_request[^;]*to (anon|authenticated)/);
});

test("the VPS agent's two functions are granted to crm_agent", () => {
  assert.match(
    sql,
    /grant execute on function public\.demo_requests_pending\(\) to service_role, crm_agent;/,
  );
  assert.match(
    sql,
    /grant execute on function public\.demo_site_set_result\(uuid, text, text, text\) to service_role, crm_agent;/,
  );
});

test("crm_agent cannot request a demo, only fulfil one", () => {
  // The agent builds what it is told to build. Letting it queue its own work
  // would put the kill switch — which lives in the app layer — outside the loop.
  assert.doesNotMatch(code(sql), /demo_site_request\([^)]*\) to [^;]*crm_agent/);
});

test("every function revokes PUBLIC before granting", () => {
  const revokes = code(sql).match(/revoke all on function/g) ?? [];
  const grants = code(sql).match(/grant execute on function/g) ?? [];
  assert.equal(revokes.length, 5, "one revoke per function");
  assert.equal(grants.length, 5, "one grant per function");
});

test("demo_site_set_result validates status in the database", () => {
  // A bad string from the agent must not be able to land a row in an impossible
  // state; the TypeScript union is a mirror of this, not the enforcement.
  assert.match(sql, /status must be building, live, failed or archived/);
});

test("the pending poll is bounded", () => {
  assert.match(sql, /limit 25/);
});

// --- charter §9 logging ----------------------------------------------------

test("the logging migration writes agent_log inside the definer", () => {
  // The app cannot log: agent_log is revoked from service_role and written by
  // definer RPCs only. Asking the app layer to do it would mean it never
  // happened.
  assert.match(logSql, /insert into agent_log\(/);
  assert.match(logSql, /'crm-demo-sites'/);
});

test("the log records a queued request, never a built site", () => {
  // Nothing has been deployed at this point. A log line claiming otherwise
  // would be the system asserting a deployment that has not happened.
  assert.match(code(logSql), /'demo_site_queued'/);
  assert.doesNotMatch(code(logSql), /demo_site_built|demo_site_deployed|'live'/);
});

test("the logging migration does not change the function signature", () => {
  // Sami's half of the contract must be untouched, and `create or replace`
  // preserves the existing ACL so the service_role grant survives.
  assert.match(logSql, /create or replace function public\.demo_site_request\(/);
  for (const param of [
    /p_company_id uuid/,
    /p_deal_id uuid/,
    /p_business_name text/,
    /p_address text/,
    /p_vertical text/,
    /p_requested_by uuid/,
  ]) {
    assert.match(logSql, param);
  }
  // It must not re-grant or re-revoke: doing so would silently reset an ACL
  // that later migrations may have widened.
  assert.doesNotMatch(code(logSql), /grant execute on function public\.demo_site_request/);
});

test("the logging migration keeps both of the original guards", () => {
  assert.match(logSql, /one of company_id or deal_id is required/);
  assert.match(logSql, /business_name is required/);
});

test("both migrations pin search_path on every function", () => {
  for (const source of [code(sql), code(logSql)]) {
    const definers = source.match(/security definer/g) ?? [];
    const paths = source.match(/set search_path = public, pg_temp/g) ?? [];
    assert.equal(definers.length, paths.length);
  }
});
