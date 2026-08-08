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
for (const key of [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
]) {
  assert(contactForm.includes(`name="${key}"`), `contact form must submit ${key}`);
}
assert(contactForm.includes("readLeadAttribution"), "contact form must read attribution");
assert(
  contactForm.includes("How did you hear about us?"),
  "contact form must ask how the lead heard about GivenTake",
);

assert(
  tracking.includes("trackLeadEvent"),
  "tracking must expose trackLeadEvent",
);
assert(
  tracking.includes("type LeadEventName") &&
    tracking.includes('"lead_form_submit_success"') &&
    tracking.includes('"lead_form_mailto_fallback"') &&
    tracking.includes('"lead_form_submit_error"'),
  "tracking must define lead event names",
);
assert(
  tracking.includes("sanitizeLeadEventProperties"),
  "tracking must sanitize lead event properties",
);
const propertiesBlock = tracking.match(/type LeadEventProperties = \{[\s\S]*?\};/)?.[0] ?? "";
for (const forbidden of ["name?:", "email?:", "company?:", "description?:", "source_detail?:"]) {
  assert(
    !propertiesBlock.includes(forbidden),
    `tracking event properties must not include personal field ${forbidden}`,
  );
}
assert(
  contactForm.includes("trackLeadEvent"),
  "contact form must call trackLeadEvent after submit outcomes",
);
assert(
  contactForm.includes("lead_form_submit_success"),
  "contact form must track successful submissions",
);
assert(
  contactForm.includes("lead_form_mailto_fallback"),
  "contact form must track mailto fallback",
);
assert(
  contactForm.includes("lead_form_submit_error"),
  "contact form must track submit errors",
);

assert(
  existsSync(join(root, "src/lib/qualification-brief.ts")),
  "qualification brief helper must exist",
);
const qualificationBrief = read("src/lib/qualification-brief.ts");
for (const token of [
  "createQualificationBrief",
  "offerMatch",
  "budget",
  "timeline",
  "source",
  "missingInformation",
  "regulated",
  "recommendedNextAction",
]) {
  assert(qualificationBrief.includes(token), `qualification brief must include ${token}`);
}
assert(
  qualificationBrief.includes("ContactInput"),
  "qualification brief must consume ContactInput",
);

for (const path of [
  "docs/templates/warm-outreach-list.csv",
  "docs/templates/referral-partner-list.csv",
  "docs/templates/customer-1-weekly-report.md",
]) {
  assert(existsSync(join(root, path)), `${path} must exist`);
}

const warmList = read("docs/templates/warm-outreach-list.csv");
const partnerList = read("docs/templates/referral-partner-list.csv");
const report = read("docs/templates/customer-1-weekly-report.md");

for (const header of [
  "name",
  "company",
  "relationship_context",
  "channel",
  "segment",
  "last_contacted",
  "follow_up_date",
  "status",
  "referral_outcome",
  "notes",
]) {
  assert(warmList.startsWith("name,"), "warm list must start with CSV headers");
  assert(warmList.includes(header), `warm list must include ${header}`);
}

for (const header of [
  "name",
  "company",
  "partner_type",
  "channel",
  "last_contacted",
  "follow_up_date",
  "status",
  "referrals_received",
  "outcome_reported_back",
  "notes",
]) {
  assert(partnerList.startsWith("name,"), "partner list must start with CSV headers");
  assert(partnerList.includes(header), `partner list must include ${header}`);
}

for (const heading of [
  "Warm Outreach",
  "Referral Partners",
  "Lead Sources",
  "Conversations Booked",
  "Proposals",
  "Follow-Ups Due",
  "Time Spent",
  "Next Week",
]) {
  assert(report.includes(heading), `weekly report must include ${heading}`);
}
assert(
  report.includes("Humans sent every prospect-facing message"),
  "weekly report must include human-send guardrail",
);

console.log("Customer #1 pipeline invariants passed.");
