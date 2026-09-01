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
  for (const fn of [
    "campaign_claim_due",
    "campaign_claim_step",
    "campaign_record_result",
    "campaign_mark_status",
  ]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}[^;]*from public`, "i"));
    assert.match(
      sql,
      new RegExp(`grant execute on function public\\.${fn}[^;]*to service_role`, "i"),
    );
  }
});

test("the claim step RPC can express all four states, not just a boolean", () => {
  // The boolean it replaces could not say "this failed and may be retried", so
  // a failed step was re-claimed every tick and skipped forever. Each of these
  // four is a distinct instruction to the runner, so all four must exist.
  assert.match(sql, /create or replace function public\.campaign_claim_step/i);
  assert.match(sql, /return 'claimed'/i);
  assert.match(sql, /return 'already_sent'/i);
  assert.match(sql, /return 'in_flight'/i);
  assert.match(sql, /return 'exhausted'/i);
});

test("the retry path is alive - a failed step raises attempts and re-claims", () => {
  // Attempts are counted here and nowhere else. Without this update a failed
  // step could never be re-claimed, which is the wedge being removed.
  assert.match(sql, /set status = 'sending', attempts = attempts \+ 1, error = null/i);
  assert.match(sql, /if v_attempts >= p_max_attempts then/i);
});

test("campaign_sends records when it was claimed, not just when it was created", () => {
  // Staleness cannot be measured from created_at: a re-claim rewrites status
  // and attempts but leaves created_at at the first attempt, so a row
  // re-claimed seconds ago would look abandoned since the first tick.
  assert.ok(sql.includes("claimed_at timestamptz not null default now()"));
  assert.ok(
    sql.includes(
      "insert into campaign_sends (enrollment_id, step_order, status, attempts, claimed_at)",
    ),
    "the first claim must stamp claimed_at",
  );
  assert.ok(
    sql.includes("attempts = attempts + 1, error = null, claimed_at = now()"),
    "a re-claim must restamp claimed_at, or a retried row inherits the first attempt's clock",
  );
});

test("a stale 'sending' row resolves to already_sent rather than stalling forever", () => {
  // The tick holding it died between claiming and recording. Whether the mail
  // went out is unknowable, and the house rule is that ambiguity resolves to
  // sent - the same rule the runner applies to a network throw. Without this
  // the enrollment is re-claimed and skipped as in_flight on every tick.
  assert.ok(sql.includes("p_stale_seconds int default 900"));
  assert.ok(
    sql.includes("v_claimed_at < now() - make_interval(secs => greatest(60, p_stale_seconds))"),
    "the floor stops a caller shrinking the window enough to sweep a live tick",
  );
  assert.ok(sql.includes("set status = 'sent', error = coalesce(error, 'stale_sending')"));
  // and it must hand the runner the state that advances the enrollment
  assert.match(sql, /'stale_sending'[\s\S]*?return 'already_sent'/i);
});

test("campaign_record_send is gone - a boolean could not express the retry state", () => {
  assert.doesNotMatch(sql, /campaign_record_send/i);
});

test("the migration is additive - no destructive statements", () => {
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|function)\b/i);
});

test("an enrollment past its last step is not claimable", () => {
  // No step row at current_step must EXCLUDE the enrollment. Defaulting the
  // delay to zero would instead make finished enrollments due on every tick,
  // churning writes and consuming the claim batch that real sends need.
  assert.doesNotMatch(sql, /coalesce\(\(\s*select\s+s\.delay_hours/i);
  assert.match(
    sql,
    /exists\s*\(\s*select\s+1\s+from\s+campaign_steps\s+s[\s\S]*?delay_hours[\s\S]*?<=\s*now\(\)/i,
  );
});

test("a converted lead is not sequenced further", () => {
  // convertLead records conversion as leads.status = 'converted'. Continuing to
  // send after that is cold outreach arriving at someone who already signed.
  assert.match(sql, /exists\s*\(\s*select\s+1\s+from\s+leads\s+l[\s\S]*?<>\s*'converted'/i);
});

test("the lead check does not join, so the row lock stays on enrollments", () => {
  // Three EXISTS checks (campaign active, step due, lead not converted) and
  // campaign_enrollments still the only table in the due CTE's FROM list.
  const due = sql.slice(sql.indexOf("with due as"), sql.indexOf("claimed as"));
  assert.equal((due.match(/\bfrom\s+campaign_enrollments\b/gi) ?? []).length, 1);
  assert.match(due, /for update skip locked/i);
});

test("the inbound paths can reach an enrollment from a provider message id", () => {
  // A bounce event and a reply both arrive knowing only the message id.
  // campaign_sends is the only place that maps one to an enrollment.
  assert.match(sql, /create or replace function public\.campaign_mark_by_message/i);
  assert.match(sql, /revoke all on function public\.campaign_mark_by_message[^;]*from public/i);
  assert.match(
    sql,
    /grant execute on function public\.campaign_mark_by_message[^;]*to service_role/i,
  );
});

test("a reply matches even though its Message-ID carries a domain", () => {
  // campaign_sends.provider_message_id holds Resend's API id - a bare uuid.
  // A reply's In-Reply-To header holds the RFC-822 form of the same id,
  // "<uuid@sending-domain>", and reply.ts hands us "uuid@sending-domain".
  // Matching only on equality means no reply ever matches and the whole reply
  // path is dead code. The local part is tried as well.
  assert.match(sql, /split_part\(p_provider_message_id, '@', 1\)/i);
});

test("an inbound event never advances the enrollment to the next step", () => {
  // Everything that arrives this way is terminal. Advancing a bounced
  // enrollment would queue the next email to an address that just bounced.
  const start = sql.indexOf("function public.campaign_mark_by_message");
  assert.ok(start > 0, "campaign_mark_by_message must exist");
  assert.doesNotMatch(sql.slice(start, sql.indexOf("$$;", start)), /current_step/i);
});

test("an unknown message id is a no-op, not an error", () => {
  // Resend also delivers events for transactional mail this engine never sent.
  assert.match(sql, /if v_enrollment is null then return; end if;/i);
});
