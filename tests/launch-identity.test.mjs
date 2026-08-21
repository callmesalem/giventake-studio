import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

const filesToScan = [
  ...walk(join(root, "src")),
  ...walk(join(root, "public")),
  join(root, ".env.example"),
].filter(
  (file) => /\.(css|html|js|json|md|ts|tsx|txt)$/.test(file) || file.endsWith(".env.example"),
);

const fileText = new Map(
  filesToScan.map((file) => [
    relative(root, file).replaceAll("\\", "/"),
    readFileSync(file, "utf8"),
  ]),
);

assertFileContains(
  "src/lib/seo.ts",
  'export const BASE_URL = "https://giventakedevs.com";',
  "SEO base URL must match the production domain.",
);
assertFileContains(
  "src/lib/seo.ts",
  'export const SITE_NAME = "GivenTake Devs";',
  "Public site name must match the new brand.",
);
assertFileContains(
  "src/lib/seo.ts",
  'export const LEGAL_ENTITY = "GivenTake Devs LLC";',
  "Legal entity must match the new LLC name.",
);
assertFileContains(
  "public/robots.txt",
  "Sitemap: https://giventakedevs.com/sitemap.xml",
  "Robots sitemap must point crawlers at production.",
);
assertFileContains(
  "src/lib/intake.ts",
  'const FALLBACK_TO = "build@giventakedevs.com";',
  "Contact fallback email must be the monitored mailbox.",
);
assertFileContains(
  "src/lib/intake.ts",
  'const PRIVACY_TO = "privacy@giventakedevs.com";',
  "Privacy fallback email must use the production domain.",
);

assertNoPublicSourceMatch("dev-on-demand-hub.lovable.app", "Old Lovable preview domain remains.");
assertNoPublicSourceMatch("giventake.dev", "Old public email/domain remains.");
assertNoPublicSourceMatch("GivenTake Goods Devs", "Old public brand remains.");

console.log("Launch identity invariants passed.");

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : path;
  });
}

function assertFileContains(file, expected, message) {
  assert.ok(
    fileText.get(file)?.includes(expected),
    `${message}\nMissing from ${file}: ${expected}`,
  );
}

function assertNoPublicSourceMatch(needle, message) {
  const offenders = [...fileText].filter(([, text]) => text.includes(needle)).map(([file]) => file);

  assert.deepEqual(offenders, [], `${message}\nFound in:\n${offenders.join("\n")}`);
}
