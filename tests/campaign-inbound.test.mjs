/**
 * The inbound reply path.
 *
 * The one rule that outranks everything else here: the engine must never be the
 * reason a customer's reply goes unseen. Matching an enrollment is bookkeeping;
 * delivering the mail to a human is the product. So the forward happens first
 * and unconditionally, and nothing the matching does can prevent it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { handleInboundEmail } from "../src/server/campaigns/inbound.ts";

/** A ForwardableEmailMessage double. Headers is a real Headers, as on Workers. */
function message(headers = {}, forward = async () => {}) {
  const forwarded = [];
  return {
    forwarded,
    headers: new Headers(headers),
    async forward(to) { forwarded.push(to); return forward(to); },
  };
}

function storeDouble(impl = async () => {}) {
  const calls = [];
  return { calls, markStatusByMessageId: async (...args) => { calls.push(args); return impl(...args); } };
}

test("marks the enrollment replied for the id the reply threads onto", async () => {
  const store = storeDouble();
  const msg = message({ "in-reply-to": "<abc@giventakedevs.com>" });
  await handleInboundEmail({ message: msg, store, forwardTo: "salem@example.com" });
  assert.deepEqual(msg.forwarded, ["salem@example.com"]);
  assert.equal(store.calls.length, 1);
  assert.equal(store.calls[0][0], "abc@giventakedevs.com");
  assert.equal(store.calls[0][1], "replied");
  assert.equal(store.calls[0][2], "replied");
});

test("forwards BEFORE it touches the store", async () => {
  // A References header on a long thread lists a dozen ids, each one a Supabase
  // round trip. Matching first puts the customer's mail behind all of them, and
  // a slow or hanging Supabase would burn the invocation before it forwards.
  const order = [];
  const store = storeDouble(async () => { order.push("store"); });
  const msg = message({ references: "<a@x> <b@x>" }, async () => { order.push("forward"); });
  await handleInboundEmail({ message: msg, store, forwardTo: "salem@example.com" });
  assert.equal(order[0], "forward");
  assert.deepEqual(order, ["forward", "store", "store"]);
});

test("forwards even when the store throws on every id", async () => {
  const store = storeDouble(async () => { throw new Error("supabase down"); });
  const msg = message({ "in-reply-to": "<abc@x>" });
  await handleInboundEmail({ message: msg, store, forwardTo: "salem@example.com" });
  assert.deepEqual(msg.forwarded, ["salem@example.com"]);
});

test("forwards even when there is nothing to match", async () => {
  const store = storeDouble();
  const msg = message({ subject: "cold inbound, no thread" });
  await handleInboundEmail({ message: msg, store, forwardTo: "salem@example.com" });
  assert.deepEqual(msg.forwarded, ["salem@example.com"]);
  assert.equal(store.calls.length, 0);
});

test("a forward that throws does not stop the matching, and does not escalate", async () => {
  // A throw out of the handler makes Cloudflare reject the message, which
  // bounces the reply back at the customer. Log it and carry on instead.
  const store = storeDouble();
  const msg = message({ "in-reply-to": "<abc@x>" }, async () => { throw new Error("not a verified destination"); });
  await handleInboundEmail({ message: msg, store, forwardTo: "salem@example.com" });
  assert.equal(store.calls.length, 1);
});

test("no forwarding address configured is not a crash", async () => {
  const store = storeDouble();
  const msg = message({ "in-reply-to": "<abc@x>" });
  await handleInboundEmail({ message: msg, store });
  assert.deepEqual(msg.forwarded, []);
  assert.equal(store.calls.length, 1);
});

test("no store configured still forwards", async () => {
  const msg = message({ "in-reply-to": "<abc@x>" });
  await handleInboundEmail({ message: msg, forwardTo: "salem@example.com" });
  assert.deepEqual(msg.forwarded, ["salem@example.com"]);
});

test("every referenced id is tried - the reply may thread onto an earlier step", async () => {
  const store = storeDouble();
  const msg = message({ "in-reply-to": "<b@x>", references: "<a@x> <b@x>" });
  await handleInboundEmail({ message: msg, store, forwardTo: "salem@example.com" });
  assert.deepEqual(store.calls.map((c) => c[0]).sort(), ["a@x", "b@x"]);
});

test("a header-controlled flood of ids cannot run unbounded", async () => {
  // References is attacker-controlled and unbounded; each id is a network call.
  const store = storeDouble();
  const many = Array.from({ length: 200 }, (_, i) => `<id${i}@x>`).join(" ");
  const msg = message({ references: many });
  await handleInboundEmail({ message: msg, store, forwardTo: "salem@example.com" });
  assert.ok(store.calls.length <= 25, `tried ${store.calls.length} ids`);
  assert.deepEqual(msg.forwarded, ["salem@example.com"]);
});
