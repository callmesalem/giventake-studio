import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const routePath = join(process.cwd(), "src/routes/studio.tsx");
assert.equal(existsSync(routePath), true, "Studio route must exist");

const source = readFileSync(routePath, "utf8");
for (const token of [
  'createFileRoute("/studio")',
  "Video Agent Studio",
  "Create campaign",
  "Approve storyboard",
  "Approve edit",
  "Send to marketing drafts",
  "createStudioCampaign",
  "renderStudioCampaign",
]) {
  assert.equal(source.includes(token), true, `Studio route must include ${token}`);
}

console.log("Video Studio dashboard contract passed.");
