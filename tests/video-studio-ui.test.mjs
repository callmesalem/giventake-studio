import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const routePath = join(process.cwd(), "src/routes/studio.tsx");
const signInPath = join(process.cwd(), "src/routes/studio.sign-in.tsx");
const callbackPath = join(process.cwd(), "src/routes/studio.auth.callback.ts");
assert.equal(existsSync(routePath), true, "Studio route must exist");
assert.equal(existsSync(signInPath), true, "Studio sign-in route must exist");
assert.equal(existsSync(callbackPath), true, "Studio callback route must exist");

const source = readFileSync(routePath, "utf8");
for (const token of [
  'createFileRoute("/studio")',
  "Video Agent Studio",
  "Create campaign",
  "Approve storyboard",
  "Approve edit",
  "Send to marketing drafts",
  "Open in Video Agent",
  "createVideoAgentHandoffUrl",
  "createStudioCampaign",
  "renderStudioCampaign",
  "beforeLoad",
  "getStudioRouteSession",
  "Outlet",
  "isStudioAuthPath",
]) {
  assert.equal(source.includes(token), true, `Studio route must include ${token}`);
}
assert.equal(source.includes("import.meta.env.DEV"), false, "Studio cannot be dev-only");
assert.equal(source.includes("const tenantId ="), false, "Browser cannot own tenant identity");

const signInSource = readFileSync(signInPath, "utf8");
assert.equal(
  signInSource.includes("Email address"),
  true,
  "Sign-in route needs an accessible email label",
);
const callbackSource = readFileSync(callbackPath, "utf8");
assert.equal(
  callbackSource.includes("completeStudioAuthCallback"),
  true,
  "Callback route must exchange the auth code server-side",
);

console.log("Video Studio dashboard contract passed.");
