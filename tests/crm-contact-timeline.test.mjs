import test from "node:test";
import assert from "node:assert/strict";
import { contactDealEvents } from "../src/lib/crm-timeline.ts";

/* ── contact deal events ──────────────────────────────────────────────────────
 * Phase 1 linked deals to contacts; the contact timeline now shows that person's
 * own deals, not just company notes. This is the pure shaping step: given deal
 * rows, produce timeline events. Tested without a database.
 */

test("maps a deal row into a deal-kind timeline event", () => {
  const [e] = contactDealEvents([
    {
      id: "d1",
      name: "Website rebuild",
      stage: "proposal_sent",
      value_usd: 12000,
      created_at: "2026-08-20T10:00:00Z",
    },
  ]);
  assert.equal(e.id, "dl-d1");
  assert.equal(e.kind, "deal");
  assert.equal(e.title, "Website rebuild");
  assert.equal(e.at, "2026-08-20T10:00:00Z");
  assert.equal(e.actor, null);
});

test("detail humanises the stage and formats the value as whole dollars", () => {
  const [e] = contactDealEvents([
    { id: "d1", name: "MVP build", stage: "proposal_sent", value_usd: 12000, created_at: null },
  ]);
  assert.equal(e.detail, "Stage: Proposal sent · $12,000");
});

test("omits missing stage and value rather than printing empty labels", () => {
  const [noStage] = contactDealEvents([
    { id: "d1", name: "Deal", stage: null, value_usd: 5000, created_at: null },
  ]);
  assert.equal(noStage.detail, "$5,000");

  const [noValue] = contactDealEvents([
    { id: "d2", name: "Deal", stage: "won", value_usd: null, created_at: null },
  ]);
  assert.equal(noValue.detail, "Stage: Won");

  const [bare] = contactDealEvents([
    { id: "d3", name: "Deal", stage: null, value_usd: null, created_at: null },
  ]);
  assert.equal(bare.detail, null);
});

test("falls back to a title when the deal has no name", () => {
  const [e] = contactDealEvents([{ id: "d1", name: null, stage: null, value_usd: null }]);
  assert.equal(e.title, "Deal");
});

test("maps every deal and no more", () => {
  const events = contactDealEvents([
    { id: "a", name: "A", stage: "won", value_usd: 1000, created_at: "2026-01-01T00:00:00Z" },
    { id: "b", name: "B", stage: "lost", value_usd: 2000, created_at: "2026-02-01T00:00:00Z" },
  ]);
  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map((e) => e.id),
    ["dl-a", "dl-b"],
  );
});

test("empty input yields no events", () => {
  assert.deepEqual(contactDealEvents([]), []);
});
