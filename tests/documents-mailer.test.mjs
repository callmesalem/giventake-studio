import test from "node:test";
import assert from "node:assert/strict";
import { sendSignatureRequest } from "../src/server/documents/mailer.ts";

/* The sender is injected, so these tests drive the REAL sendSignatureRequest
 * with a fake in place of intake.ts's sendMail. Nothing here re-implements the
 * message: a test that rebuilds the body it is checking proves only that the
 * test author can concatenate strings. */

const capture = (status = "sent") => {
  const calls = [];
  const send = async (to, subject, text, replyTo) => {
    calls.push({ to, subject, text, replyTo });
    return { status };
  };
  return { calls, send };
};

const INPUT = {
  to: "ada@example.com",
  recipientName: "Ada Lovelace",
  documentTitle: "SOW — Client Portal",
  signUrl: "https://giventakedevs.com/sign/abc123",
  replyTo: "build@giventakedevs.com",
};

test("the subject names the document", async () => {
  const { calls, send } = capture();
  await sendSignatureRequest(send, INPUT);
  assert.equal(calls[0].subject, "Please sign: SOW — Client Portal");
});

test("the body addresses the recipient by name", async () => {
  const { calls, send } = capture();
  await sendSignatureRequest(send, INPUT);
  assert.match(calls[0].text, /Hello Ada Lovelace,/);
});

test("the body contains the signing URL exactly once", async () => {
  const { calls, send } = capture();
  await sendSignatureRequest(send, INPUT);
  const occurrences = calls[0].text.split(INPUT.signUrl).length - 1;
  assert.equal(occurrences, 1);
});

test("the body states the expiry, which the schema also enforces", async () => {
  const { calls, send } = capture();
  await sendSignatureRequest(send, INPUT);
  assert.match(calls[0].text, /expires in 7 days/);
});

test("the recipient and reply-to are passed through unchanged", async () => {
  const { calls, send } = capture();
  await sendSignatureRequest(send, INPUT);
  assert.equal(calls[0].to, "ada@example.com");
  assert.equal(calls[0].replyTo, "build@giventakedevs.com");
});

test("sent is true only when the provider reports sent", async () => {
  const { send } = capture("sent");
  assert.deepEqual(await sendSignatureRequest(send, INPUT), { sent: true });
});

test("an unconfigured mailer reports not sent rather than throwing", async () => {
  const { send } = capture("unconfigured");
  assert.deepEqual(await sendSignatureRequest(send, INPUT), { sent: false });
});

test("a provider error reports not sent", async () => {
  const { send } = capture("error");
  assert.deepEqual(await sendSignatureRequest(send, INPUT), { sent: false });
});

test("the message is plain text — no HTML is smuggled in", async () => {
  const { calls, send } = capture();
  await sendSignatureRequest(send, INPUT);
  assert.doesNotMatch(calls[0].text, /<[a-z]/i);
});
