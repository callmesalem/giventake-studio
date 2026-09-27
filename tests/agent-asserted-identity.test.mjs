// The migration that lets the Worker vouch for an agent. Pinned as text, like
// tests/agent-capabilities.test.mjs, because the claims are about what the SQL
// says; tests/crm-grants.integration.test.mjs proves what it does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260924120000_agent_asserted_identity.sql", "utf8");

const CAPABILITIES = [
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
  "approval_decide",
];

test("agent_require reads x-agent-role from PostgREST's request.headers", () => {
  assert.match(sql, /current_setting\('request\.headers', true\)::json ->> 'x-agent-role'/);
});

test("an asserted name must look like an agent role and never an exempt login", () => {
  assert.match(sql, /'\^agent_\[a-z_\]\{1,40\}\$'/);
  for (const exempt of ["authenticator", "postgres", "supabase_admin", "cli_login_postgres"]) {
    assert.match(sql, new RegExp(`bad_assertion[\\s\\S]*'${exempt}'|'${exempt}'[\\s\\S]*bad_assertion`), exempt);
  }
});

test("approval_decide is guarded by its own capability", () => {
  const body = sql.slice(sql.indexOf("function public.approval_decide"));
  assert.match(body, /perform public\.agent_require\('approval_decide'\)/);
});

test("agent_perplexity gets every capability row, all off", () => {
  for (const capability of CAPABILITIES) {
    assert.match(
      sql,
      new RegExp(`\\('agent_perplexity',\\s*'${capability}',\\s*false`),
      `${capability} row missing or not off`,
    );
  }
  assert.doesNotMatch(sql, /\('agent_perplexity',\s*'[a-z_]+',\s*true/);
});

test("agent_capabilities_for is service_role only", () => {
  assert.match(sql, /revoke all on function public\.agent_capabilities_for\(text\) from public/);
  assert.match(sql, /grant execute on function public\.agent_capabilities_for\(text\) to service_role/);
  assert.doesNotMatch(sql, /agent_capabilities_for\(text\) to (anon|authenticated|crm_agent|agent_sami)/);
});
