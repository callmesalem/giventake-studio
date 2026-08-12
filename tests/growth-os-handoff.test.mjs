import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const contact = read("src/components/sections/contact.tsx");
const intakeSchema = read("src/lib/intake-schema.ts");
const intake = read("src/lib/intake.ts");
const signer = read("src/lib/growth-os-ingest.ts");
const tracking = read("src/lib/tracking.ts");

assert.match(
  contact,
  /Please confirm you've read the privacy notice|I've read the/,
  "Contact form must preserve its privacy acknowledgment.",
);
for (const category of ["necessary", "preferences", "analytics", "marketing", "gpc"]) {
  assert.ok(
    contact.includes(category) || intakeSchema.includes(category),
    `Contact handoff must include ${category} consent state.`,
  );
}
assert.ok(
  contact.includes("useConsent"),
  "Contact form must read the current consent and GPC state.",
);
assert.ok(
  contact.includes("detectGpc()"),
  "Contact submission must re-check GPC at submit time before creating its receipt.",
);
assert.ok(
  intake.includes("Promise.allSettled"),
  "Email and Growth OS delivery must run independently.",
);
assert.ok(
  signer.includes('env("GROWTH_OS_SITE_SIGNING_SECRET")') &&
    signer.includes("process.env[key]") &&
    !signer.includes("import.meta.env") &&
    !signer.includes("VITE_GROWTH_OS"),
  "Growth OS signing configuration must remain server-only.",
);
assert.ok(
  /marketing[^\n]*false|!.*marketing|gpc/.test(signer) && signer.includes("click_ids"),
  "Growth OS handoff must clear click IDs without marketing consent or under GPC.",
);
assert.ok(
  contact.includes("new URL(d.referrer).hostname") &&
    !contact.includes("`Referrer: ${d.referrer}`"),
  "Mail-client fallback must keep only the referrer hostname.",
);

const source = ts.createSourceFile(
  "contact.tsx",
  contact,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const calls = [];
let propertyBuilder;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "leadEventProps") {
    propertyBuilder = node;
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "trackLeadEvent"
  ) {
    calls.push(node);
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(calls.length >= 3, "Contact form must retain success, error, and fallback lead events.");
for (const call of calls) {
  assert.equal(
    call.arguments.length,
    2,
    "trackLeadEvent must receive a name and safe properties only.",
  );
  const properties = call.arguments[1];
  assert.ok(
    ts.isCallExpression(properties) &&
      ts.isIdentifier(properties.expression) &&
      properties.expression.text === "leadEventProps",
    "Every contact lead event must pass through the allowlisted property builder.",
  );
}

assert.ok(propertyBuilder, "Contact form must define its lead-event property allowlist.");
const propertyText = propertyBuilder.getText(source);
for (const allowed of ["budget", "timeline", "source"]) {
  assert.ok(propertyText.includes(allowed), `Lead event properties must retain ${allowed}.`);
}
for (const prohibited of ["name", "email", "company", "description", "phone", "notes"]) {
  assert.ok(
    !new RegExp(`\\b${prohibited}\\b`).test(propertyText),
    `trackLeadEvent properties must not contain ${prohibited}.`,
  );
}

assert.ok(
  tracking.includes("currentConsent.analytics") && tracking.includes("currentConsent.marketing"),
  "trackLeadEvent must remain consent-gated inside the tracking module.",
);

console.log("Growth OS public handoff invariants passed.");

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
