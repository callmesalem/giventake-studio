import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const intakeSchema = read("src/lib/intake-schema.ts");
const contactForm = read("src/components/sections/contact.tsx");
const tracking = read("src/lib/tracking.ts");

assert(
  intakeSchema.includes("CONTACT_SOURCE_OPTIONS"),
  "contact schema must export CONTACT_SOURCE_OPTIONS",
);
assert(intakeSchema.includes("source:"), "contact schema must validate source");
assert(intakeSchema.includes("source_detail"), "contact schema must validate source_detail");
for (const key of [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
]) {
  assert(intakeSchema.includes(key), `contact schema must validate ${key}`);
}

assert(
  existsSync(join(root, "src/lib/lead-attribution.ts")),
  "lead attribution helper must exist",
);
const attribution = read("src/lib/lead-attribution.ts");
assert(attribution.includes("ATTRIBUTION_KEYS"), "attribution helper must list keys");
assert(attribution.includes("readLeadAttribution"), "attribution helper must export reader");
assert(attribution.includes("URLSearchParams"), "attribution helper must read UTM query params");
assert(attribution.includes("document.referrer"), "attribution helper must capture referrer");

assert(
  contactForm.includes('name="source"'),
  "contact form must include a visible source field",
);
assert(
  contactForm.includes('name="source_detail"'),
  "contact form must include source detail field",
);
assert(
  contactForm.includes("How did you hear about us?"),
  "contact form must ask how the lead heard about GivenTake",
);

assert(
  tracking.includes("trackLeadEvent"),
  "tracking must expose trackLeadEvent",
);

console.log("Customer #1 pipeline invariants passed.");
