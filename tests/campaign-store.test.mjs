import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseCampaignStore } from "../src/server/campaigns/supabase-store.ts";

const store = (handler) =>
  createSupabaseCampaignStore({
    url: "https://p.supabase.co",
    serviceRoleKey: "svc",
    fetch: handler,
  });

const ok = (body) => ({
  ok: true,
  status: 200,
  async json() {
    return body;
  },
});

test("claimDue maps RPC rows into DueSend", async () => {
  const s = store(async () =>
    ok([
      {
        enrollmentId: "e1",
        campaignId: "c1",
        stepOrder: 0,
        sop: "outreach",
        email: "x@y.com",
        name: "X",
        template: { subject: "S", text: "T" },
      },
    ]),
  );
  const rows = await s.claimDue(10, 300);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].enrollmentId, "e1");
});

test("claimDue tolerates a non-array response", async () => {
  const s = store(async () => ok(null));
  assert.deepEqual(await s.claimDue(10, 300), []);
});

test("claimDue sends the service role key and hits the RPC path", async () => {
  let seen;
  const s = store(async (url, init) => {
    seen = { url, init };
    return ok([]);
  });
  await s.claimDue(10, 300);
  assert.match(seen.url, /\/rest\/v1\/rpc\/campaign_claim_due$/);
  assert.equal(seen.init.headers.apikey, "svc");
  assert.match(seen.init.headers.Authorization, /^Bearer svc$/);
});

test("a failed claim throws rather than silently returning nothing", async () => {
  const s = store(async () => ({
    ok: false,
    status: 500,
    async json() {
      return {};
    },
  }));
  await assert.rejects(() => s.claimDue(10, 300));
});

test("claimStep returns the state string from the RPC", async () => {
  const s = store(async () => ok("already_sent"));
  assert.equal(await s.claimStep("e1", 0), "already_sent");
});

test("a failed claimStep throws - it must never look like a claim", async () => {
  const s = store(async () => ({
    ok: false,
    status: 503,
    async json() {
      return {};
    },
  }));
  await assert.rejects(() => s.claimStep("e1", 0));
});

test("recordResult posts the enrollment, step and status", async () => {
  let seen;
  const s = store(async (url, init) => {
    seen = { url, init };
    return ok(null);
  });
  await s.recordResult("e1", 2, "sent", "msg-9");
  assert.match(seen.url, /campaign_record_result$/);
  const body = JSON.parse(seen.init.body);
  assert.equal(body.p_enrollment_id, "e1");
  assert.equal(body.p_step_order, 2);
  assert.equal(body.p_status, "sent");
  assert.equal(body.p_provider_message_id, "msg-9");
});

test("markStatus passes the advance flag and details through", async () => {
  let seen;
  const s = store(async (url, init) => {
    seen = init;
    return ok(null);
  });
  await s.markStatus("e1", "active", true, "sent", { step: 0 });
  const body = JSON.parse(seen.body);
  assert.equal(body.p_advance, true);
  assert.deepEqual(body.p_details, { step: 0 });
});

test("gate checks map to the existing RPC names", async () => {
  const urls = [];
  const s = store(async (url) => {
    urls.push(url);
    return ok(true);
  });
  await s.isSuppressed("a@b.com");
  await s.isApprovedRecipient("a@b.com", "outreach");
  assert.match(urls[0], /operator_is_suppressed$/);
  assert.match(urls[1], /is_approved_recipient$/);
});

test("markStatusByMessageId posts the provider message id to the lookup RPC", async () => {
  let seen;
  const s = store(async (url, init) => {
    seen = { url, init };
    return ok(null);
  });
  await s.markStatusByMessageId("msg-9", "bounced", "bounced", { type: "email.bounced" });
  assert.match(seen.url, /\/rest\/v1\/rpc\/campaign_mark_by_message$/);
  const body = JSON.parse(seen.init.body);
  assert.equal(body.p_provider_message_id, "msg-9");
  assert.equal(body.p_status, "bounced");
  assert.equal(body.p_event_type, "bounced");
  assert.deepEqual(body.p_details, { type: "email.bounced" });
});

test("a failed markStatusByMessageId throws so the caller can retry", async () => {
  // The bounce endpoint answers Resend with a 500 on this throw, which is what
  // makes Resend redeliver. Swallowing here would drop the bounce for good.
  const s = store(async () => ({
    ok: false,
    status: 500,
    async json() {
      return {};
    },
  }));
  await assert.rejects(() => s.markStatusByMessageId("msg-9", "bounced", "bounced", {}));
});
