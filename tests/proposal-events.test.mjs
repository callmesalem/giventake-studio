import test from "node:test";
import assert from "node:assert/strict";
import { proposalEvents } from "../src/lib/crm-timeline.ts";

const base = {
  id: "p1",
  version: 2,
  title: "Site",
  status: "accepted",
  sent_at: "2026-10-01T00:00:00Z",
  decided_at: "2026-10-02T00:00:00Z",
  accepted_option: "full",
};

test("proposal events: sent always, decided only when accepted or declined", () => {
  assert.deepEqual(
    proposalEvents([base]).map((e) => e.title),
    ["Proposal v2 sent", "Proposal v2 accepted"],
  );
  assert.deepEqual(
    proposalEvents([{ ...base, status: "superseded" }]).map((e) => e.title),
    ["Proposal v2 sent"],
  );
  assert.deepEqual(
    proposalEvents([{ ...base, sent_at: null, decided_at: null, status: "draft" }]),
    [],
  );
  assert.equal(proposalEvents([base])[0].kind, "proposal");
});
