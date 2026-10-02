import assert from "node:assert/strict";
import {
  formatMessageEmail,
  formatMessageSms,
  parsePhoneMessagePayload,
  renderMessageEmailHtml,
} from "../src/lib/phone-message.ts";

/**
 * Phone-message intake: payload validation and message formatting.
 * The live sends (Resend, Twilio) are in the route handler and are not
 * exercised here.
 */

const full = {
  caller_name: "Jane Miller",
  callback_number: "(440) 334-7835",
  company: "Miller Bakery",
  reason: "Wants a new website for the bakery",
  preferred_callback_time: "Tomorrow morning",
};

{
  const parsed = parsePhoneMessagePayload(full);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.message.callerName, "Jane Miller");
    assert.equal(parsed.message.callbackNumber, "+14403347835");
    assert.equal(parsed.message.company, "Miller Bakery");
    assert.equal(parsed.message.reason, "Wants a new website for the bakery");
    assert.equal(parsed.message.preferredCallbackTime, "Tomorrow morning");
  }
}

{
  // camelCase accepted too
  const parsed = parsePhoneMessagePayload({
    callerName: "Bob",
    callbackNumber: "2164285999",
    reason: "Pricing question",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.message.callbackNumber, "+12164285999");
    assert.equal(parsed.message.company, null);
    assert.equal(parsed.message.preferredCallbackTime, null);
  }
}

{
  // 11-digit US number keeps its country code
  const parsed = parsePhoneMessagePayload({
    caller_name: "Bob",
    callback_number: "+1 216-428-5999",
    reason: "Hi",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.message.callbackNumber, "+12164285999");
}

for (const bad of [
  [{}, "empty object"],
  [{ caller_name: "Jane" }, "missing number and reason"],
  [{ ...full, caller_name: "  " }, "blank name"],
  [{ ...full, callback_number: "123" }, "too-short number"],
  [{ ...full, callback_number: "not a number" }, "non-numeric number"],
  [{ ...full, reason: "" }, "blank reason"],
  ["nope", "non-object payload"],
  [null, "null payload"],
]) {
  const parsed = parsePhoneMessagePayload(bad[0]);
  assert.equal(parsed.ok, false, `expected rejection: ${bad[1]}`);
}

{
  const parsed = parsePhoneMessagePayload(full);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const email = formatMessageEmail(parsed.message);
    assert.equal(email.subject, "New call message: Jane Miller");
    assert.match(email.textBody, /Jane Miller/);
    assert.match(email.textBody, /\+14403347835/);
    assert.match(email.textBody, /Miller Bakery/);
    assert.match(email.textBody, /Tomorrow morning/);
    assert.doesNotMatch(email.subject, /—/);
  }
}

{
  // Optional fields omitted cleanly
  const parsed = parsePhoneMessagePayload({
    caller_name: "Bob",
    callback_number: "2164285999",
    reason: "Pricing",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const email = formatMessageEmail(parsed.message);
    assert.doesNotMatch(email.textBody, /Company:/);
    assert.doesNotMatch(email.textBody, /Preferred callback time:/);
  }
}

{
  const parsed = parsePhoneMessagePayload({
    ...full,
    reason: "x".repeat(500),
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const sms = formatMessageSms(parsed.message);
    assert.ok(sms.length <= 160, `sms is ${sms.length} chars, must fit one segment`);
    assert.match(sms, /Jane Miller/);
    assert.match(sms, /\+14403347835/);
  }
}

{
  const parsed = parsePhoneMessagePayload({
    ...full,
    reason: "<script>alert(1)</script>",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const html = renderMessageEmailHtml(parsed.message);
    assert.match(html, /Jane Miller/);
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /GivenTake Goods LLC/);
  }
}

console.log("phone-message.test.mjs: all assertions passed");
