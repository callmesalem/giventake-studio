import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261014120000_capture_lead_into_contacts.sql"),
  "utf8",
);
const fn = sql.slice(sql.indexOf("create or replace function public.capture_website_lead"));

test("capture mirrors every lead into contacts with the Phase 1 fold key", () => {
  // crmContact reads source='lead_migration' + source_record_id=<lead id> to
  // pull the lead's touchpoints into the timeline; another key breaks that.
  assert.match(fn, /insert into contacts \(/);
  assert.match(fn, /'lead_migration', l\.id::text, 'lead'/);
  assert.match(fn, /on conflict \(source, source_record_id\) do update set/);
});

test("a repeat submission never changes the contact's lifecycle stage", () => {
  const start = fn.indexOf("do update set");
  const update = fn.slice(start, fn.indexOf("end if;", start));
  assert.doesNotMatch(update, /lifecycle_stage/);
});

test("a person already in contacts under another key is not duplicated", () => {
  assert.match(fn, /not \(source = 'lead_migration' and source_record_id = v_lead::text\)/);
});

test("existing leads are backfilled, real ones only", () => {
  const backfill = sql.slice(sql.indexOf("-- Backfill"));
  assert.match(backfill, /where l\.synthetic = false/);
  assert.match(backfill, /on conflict \(source, source_record_id\) do nothing/);
});
