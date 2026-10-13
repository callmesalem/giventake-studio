import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261012130000_campaign_authoring.sql"),
  "utf8",
);

test("authoring RPCs are service_role only, matching the engine's posture", () => {
  for (const fn of ["campaign_step_upsert", "campaign_step_delete", "campaign_detail"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}[^;]*from public`, "i"));
    assert.match(
      sql,
      new RegExp(`grant execute on function public\\.${fn}[^;]*to service_role`, "i"),
    );
  }
});

test("a step cannot be saved without a subject and a text body", () => {
  assert.match(sql, /template needs a subject and a text body/i);
});

test("claim_due still stops on conversion and still uses SKIP LOCKED", () => {
  const claim = sql.slice(sql.indexOf("function public.campaign_claim_due"));
  assert.match(claim, /<> 'converted'/);
  assert.match(claim, /for update skip locked/i);
  assert.match(claim, /'company',\s+l\.company/);
});
