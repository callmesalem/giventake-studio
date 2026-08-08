import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const files = {
  pricing: read("src/components/sections/pricing.tsx"),
  contact: read("src/components/sections/contact.tsx"),
  tracking: read("src/lib/tracking.ts"),
  cookies: read("src/routes/cookies.tsx"),
  privacy: read("src/routes/privacy.tsx"),
  terms: read("src/routes/terms.tsx"),
  footer: read("src/components/site-chrome.tsx"),
  sitemap: read("src/routes/sitemap[.]xml.ts"),
  env: read(".env.example"),
};

const compact = (text) => text.replace(/\s+/g, " ");

assert.ok(
  files.pricing.includes('name: "Essentials"') &&
    files.pricing.includes('price: "$500 - $2.5K"') &&
    files.pricing.includes("Small builds, fixes, and single-page sites."),
  "Pricing must restore the intentionally added Essentials $500-$2.5K tier.",
);

assert.ok(
  compact(files.pricing).includes("Essentials work starts at $500") &&
    compact(files.pricing).includes("most custom builds start at $2,500"),
  "Pricing copy must clearly distinguish small Essentials work from larger custom builds.",
);

assert.ok(
  files.contact.includes('<SelectItem value="500-2.5k">$500 to $2.5k</SelectItem>') &&
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
