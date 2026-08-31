import test from "node:test";
import assert from "node:assert/strict";
import { createResendMailer } from "../src/server/campaigns/mailer.ts";

const ok = (body) => ({ ok: true, status: 200, async json() { return body; } });

test("sends and returns the provider message id", async () => {
  let seen;
  const mailer = createResendMailer({
    apiKey: "k", from: "a@b.com",
    fetch: async (url, init) => { seen = { url, init }; return ok({ id: "msg-1" }); },
  });
  const out = await mailer.send({ to: "x@y.com", subject: "S", text: "T", replyTo: "r@b.com" });
  assert.deepEqual(out, { status: "sent", providerMessageId: "msg-1" });
  assert.equal(seen.url, "https://api.resend.com/emails");
  const body = JSON.parse(seen.init.body);
  assert.deepEqual(body.to, ["x@y.com"]);
  assert.equal(body.reply_to, "r@b.com");
});

test("a 422 is permanent - retrying a rejected address cannot help", async () => {
  const mailer = createResendMailer({
    apiKey: "k", from: "a@b.com",
    fetch: async () => ({ ok: false, status: 422, async json() { return {}; } }),
  });
  const out = await mailer.send({ to: "bad", subject: "S", text: "T", replyTo: "r@b.com" });
  assert.equal(out.status, "failed");
  assert.equal(out.permanent, true);
});

test("a 429 is not permanent - rate limiting should be retried", async () => {
  const mailer = createResendMailer({
    apiKey: "k", from: "a@b.com",
    fetch: async () => ({ ok: false, status: 429, async json() { return {}; } }),
  });
  const out = await mailer.send({ to: "x@y.com", subject: "S", text: "T", replyTo: "r@b.com" });
  assert.equal(out.status, "failed");
  assert.notEqual(out.permanent, true);
});

test("a thrown network error is not permanent", async () => {
  const mailer = createResendMailer({
    apiKey: "k", from: "a@b.com",
    fetch: async () => { throw new Error("boom"); },
  });
  const out = await mailer.send({ to: "x@y.com", subject: "S", text: "T", replyTo: "r@b.com" });
  assert.equal(out.status, "failed");
  assert.notEqual(out.permanent, true);
});

test("a 500 is not permanent - the provider may recover", async () => {
  const mailer = createResendMailer({
    apiKey: "k", from: "a@b.com",
    fetch: async () => ({ ok: false, status: 500, async json() { return {}; } }),
  });
  const out = await mailer.send({ to: "x@y.com", subject: "S", text: "T", replyTo: "r@b.com" });
  assert.notEqual(out.permanent, true);
});

test("never puts the message body in the error - it is personal data", async () => {
  const mailer = createResendMailer({
    apiKey: "k", from: "a@b.com",
    fetch: async () => ({ ok: false, status: 500, async json() { return { detail: "SECRET" }; } }),
  });
  const out = await mailer.send({ to: "x@y.com", subject: "S", text: "SECRET", replyTo: "r@b.com" });
  assert.doesNotMatch(out.error ?? "", /SECRET/);
});

test("passes custom headers through - List-Unsubscribe depends on this", async () => {
  let seen;
  const mailer = createResendMailer({
    apiKey: "k", from: "a@b.com",
    fetch: async (url, init) => { seen = init; return ok({ id: "m" }); },
  });
  await mailer.send({
    to: "x@y.com", subject: "S", text: "T", replyTo: "r@b.com",
    headers: { "List-Unsubscribe": "<https://example.com/u/t>" },
  });
  assert.equal(JSON.parse(seen.body).headers["List-Unsubscribe"], "<https://example.com/u/t>");
});
