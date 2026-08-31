import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260831120000_campaign_engine.sql"),
  "utf8",
);

test("adds the sop column the allowlist gate requires", () => {
  assert.match(sql, /alter table public\.campaigns\s+add column if not exists sop text/i);
});

test("campaign_sends carries the uniqueness that prevents double sends", () => {
  assert.match(sql, /create table if not exists public\.campaign_sends/i);
  assert.match(sql, /unique \(enrollment_id, step_order\)/i);
});

test("claim RPC uses SKIP LOCKED so concurrent ticks cannot claim the same row", () => {
  assert.match(sql, /for update skip locked/i);
});

test("RPCs are service_role only, matching the rest of this schema", () => {
  for (const fn of ["campaign_claim_due", "campaign_record_send", "campaign_mark_status"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}[^;]*from public`, "i"));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}[^;]*to service_role`, "i"));
  }
});

test("the migration is additive - no destructive statements", () => {
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|function)\b/i);
});
