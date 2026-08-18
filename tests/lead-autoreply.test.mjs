import assert from "node:assert/strict";
import {
  CHARTER_FOOTER,
  LEAD_AUTOREPLY_SUBJECT,
  autoReplyFlagEnabled,
  firstNameOf,
  renderLeadAutoReply,
  shouldSendAutoReply,
} from "../src/lib/lead-autoreply.ts";

// --- Dormancy: the flag defaults OFF and only explicit truthy strings enable it.
assert.equal(autoReplyFlagEnabled(undefined), false, "unset flag => OFF");
assert.equal(autoReplyFlagEnabled(""), false, "empty flag => OFF");
assert.equal(autoReplyFlagEnabled("false"), false, "'false' => OFF");
assert.equal(autoReplyFlagEnabled("0"), false, "'0' => OFF");
assert.equal(autoReplyFlagEnabled("off"), false, "'off' => OFF");
assert.equal(autoReplyFlagEnabled("nonsense"), false, "garbage => OFF");
for (const on of ["true", "TRUE", " 1 ", "yes", "on", "On"]) {
  assert.equal(autoReplyFlagEnabled(on), true, `'${on}' => ON`);
}

// --- shouldSendAutoReply: ALL gates required. The default posture is NO SEND.
const allGood = {
  flag: "true",
  apiKey: "re_x",
  from: "GivenTake <noreply@giventakedevs.com>",
  persisted: true,
  suppressed: false,
};
assert.equal(shouldSendAutoReply(allGood), true, "all gates satisfied => send");

// Prove NO send when the flag is off or keys are missing (the critical dormancy case).
assert.equal(shouldSendAutoReply({ ...allGood, flag: undefined }), false, "flag unset => no send");
assert.equal(shouldSendAutoReply({ ...allGood, flag: "false" }), false, "flag false => no send");
assert.equal(
  shouldSendAutoReply({ ...allGood, apiKey: undefined }),
  false,
  "no API key => no send",
);
assert.equal(shouldSendAutoReply({ ...allGood, from: undefined }), false, "no sender => no send");

// Suppression is authoritative: do_not_contact and unknown-suppression both skip.
assert.equal(
  shouldSendAutoReply({ ...allGood, suppressed: true }),
  false,
  "do_not_contact address => no send",
);
assert.equal(
  shouldSendAutoReply({ ...allGood, persisted: false }),
  false,
  "lead not persisted (suppression unknown) => no send",
);

// The safest all-default state (nothing configured) never sends.
assert.equal(
  shouldSendAutoReply({
    flag: undefined,
    apiKey: undefined,
    from: undefined,
    persisted: false,
    suppressed: false,
  }),
  false,
  "nothing configured => no send",
);

// --- Template render: {{first_name}} substituted, charter §5 footer verbatim.
const body = renderLeadAutoReply("Chuck Barnaby");
assert.match(body, /^Hi Chuck,/, "first name substituted from full name");
assert.ok(!body.includes("Barnaby"), "surname dropped");
assert.ok(body.includes("you bring the problem"), "how-we-work body present");
assert.ok(body.includes("- You tell us the problem or the idea."), "bullets present");
assert.ok(body.endsWith(CHARTER_FOOTER), "ends with the charter §5 footer verbatim");
assert.ok(
  body.includes("This message was sent automatically by GivenTake Devs."),
  "footer disclosure line present",
);

// Guardrails: no specific price/timeline/availability, no personal signature.
assert.ok(!/[$£€]\s?\d/.test(body), "no specific price");
assert.ok(!/\b\d+\s?(days?|weeks?|months?|hours?)\b/i.test(body), "no specific timeline");
assert.ok(!/\bBest,|\bRegards,|\bThanks,\s*\n\s*[A-Z]/.test(body), "no personal sign-off");

// Fallback: single-word / empty names never render "Hi ,".
assert.match(renderLeadAutoReply("Chuck"), /^Hi Chuck,/, "single-word name");
assert.match(renderLeadAutoReply("   "), /^Hi there,/, "blank name falls back to 'there'");
assert.equal(firstNameOf("Ada Lovelace"), "Ada");

// Subject carries no price/timeline/availability.
assert.ok(!/[$£€]\s?\d/.test(LEAD_AUTOREPLY_SUBJECT), "subject has no price");

console.log("lead auto-reply: ok");
