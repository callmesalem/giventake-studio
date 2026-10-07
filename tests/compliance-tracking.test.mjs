import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const files = {
  pricing: read("src/components/sections/pricing.tsx"),
  contact: read("src/components/sections/contact.tsx"),
  contactOptions: read("src/lib/contact-options.ts"),
  tracking: read("src/lib/tracking.ts"),
  cookies: read("src/routes/cookies.tsx"),
  privacy: read("src/routes/privacy.tsx"),
  terms: read("src/routes/terms.tsx"),
  footer: read("src/components/site-chrome.tsx"),
  sitemap: read("src/routes/sitemap[.]xml.ts"),
  env: read(".env.example"),
  process: read("src/routes/process.tsx"),
  articles: read("src/routes/articles.$slug.tsx"),
  offers: read("src/lib/offers.ts"),
  assistant: read("src/lib/assistant.ts"),
};

const compact = (text) => text.replace(/\s+/g, " ");

const pricingCopy = compact(files.pricing);

assert.ok(
  pricingCopy.includes("$499") &&
    pricingCopy.includes("quoted in writing") &&
    pricingCopy.includes("Payment plans and financing") &&
    pricingCopy.includes("own the site outright"),
  "Pricing must lead with custom builds starting at $499: written quote, payment plans, client owns the site.",
);

assert.ok(
  pricingCopy.includes("$99") &&
    pricingCopy.includes("Cancel any time") &&
    pricingCopy.includes("monthly proof report"),
  "Pricing must show the optional $99/mo care plan, cancel anytime, with the monthly proof report.",
);

assert.ok(
  !/\$249|\$399|\$549|\$4,500|12-month initial term|Discovery sprint/.test(files.pricing),
  "Pricing must not reintroduce the retired tiers, the 12-month term, or the priced discovery sprint.",
);

// The retired model leaked across more than the pricing section, so the guard
// covers every page that describes the offer, the process, or the paperwork.
// Each entry is [label, regex, why it is wrong now].
const retiredModel = [
  ["retired price tiers", /\$249|\$399|\$549/, "prices are $499 builds and the $99/mo care plan"],
  ["12-month initial term", /12-month initial term/i, "the care plan is month to month"],
  ["priced discovery sprint", /discovery sprint/i, "scoping is part of quoting and unbilled"],
  ["quarterly reporting", /quarterly/i, "the proof report is monthly"],
  [
    "master services agreement",
    /master services agreement/i,
    "the written quote and proposal is the governing document",
  ],
  [
    "statement of work",
    /statement of work/i,
    "the written quote and proposal is the governing document",
  ],
  [
    "never-quote-a-price rule",
    /NEVER quote a price/,
    "starting prices are published, so the assistant may share them",
  ],
  ["licensed while subscribed", /licensed while subscribed/i, "the buyer owns the site outright"],
];

for (const [file, source] of Object.entries({
  "pricing.tsx": files.pricing,
  "process.tsx": files.process,
  "terms.tsx": files.terms,
  "articles.$slug.tsx": files.articles,
  "offers.ts": files.offers,
  "assistant.ts": files.assistant,
})) {
  for (const [label, pattern, why] of retiredModel) {
    assert.ok(!pattern.test(source), `${file} must not reintroduce ${label}: ${why}.`);
  }
}

assert.ok(
  compact(files.process).includes("Call") &&
    compact(files.process).includes("a written quote and proposal") &&
    compact(files.process).includes("$499") &&
    compact(files.process).includes("$99"),
  "Process page must describe the five steps, the written quote, and both published prices.",
);

assert.ok(
  files.contact.includes("CONTACT_BUDGET_OPTIONS.map") &&
    files.contactOptions.includes('{ value: "500-2.5k", label: "$500 to $2.5k" }') &&
    compact(files.contact).includes(
      "Do not include regulated, financial, health, credential, or sensitive personal data",
    ),
  "Contact form must include the low-budget range and clear sensitive-data warning.",
);

assert.ok(existsSync(join(root, "src/routes/compliance.tsx")), "Compliance route must exist.");
const compliance = read("src/routes/compliance.tsx");

for (const required of [
  "Not legal, tax, financial, securities, investment, or regulatory compliance advice",
  "clear and conspicuous",
  "Global Privacy Control",
  "Consent Mode v2",
  "not a guarantee that every law or regulation applies the same way",
]) {
  assert.ok(
    compact(compliance).includes(required),
    `Compliance page missing required disclosure: ${required}`,
  );
}

assert.ok(
  files.footer.includes('{ label: "Compliance", href: "/compliance" }') &&
    files.sitemap.includes('{ path: "/compliance"'),
  "Compliance notice must be linked in the footer and sitemap.",
);

assert.ok(
  !files.privacy.includes("GDPR, CCPA, and ePrivacy compliant") &&
    files.privacy.includes("GDPR, CCPA/CPRA, and ePrivacy-oriented"),
  "Privacy copy must avoid an unqualified compliance guarantee.",
);

for (const required of ["VITE_GOOGLE_ADS_ID", "VITE_MICROSOFT_UET_TAG_ID"]) {
  assert.ok(files.tracking.includes(required), `Tracking loader missing ${required}.`);
  assert.ok(files.env.includes(required), `.env.example missing ${required}.`);
}

for (const required of [
  'ad_storage: "denied"',
  'ad_user_data: "denied"',
  'ad_personalization: "denied"',
]) {
  assert.ok(files.tracking.includes(required), `Tracking loader missing ${required}.`);
}

for (const required of [
  "Google Ads",
  "Microsoft Advertising",
  "Consent Mode v2",
  "denied by default",
]) {
  assert.ok(compact(files.cookies).includes(required), `Cookie policy missing ${required}.`);
}

assert.ok(
  compact(files.terms).includes(
    "securities, investment, legal, tax, accounting, privacy, security, or regulatory advice",
  ),
  "Terms must include regulated-advice warning.",
);

console.log("Compliance and tracking invariants passed.");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}
