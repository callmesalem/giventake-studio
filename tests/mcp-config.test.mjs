// The gateway's plain vars must live in wrangler.jsonc: a deploy drops any plain
// var set only in the dashboard. The SDK must be a runtime dependency because
// the Worker bundle imports it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wrangler = readFileSync("wrangler.jsonc", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("the MCP server SDK is a runtime dependency at 2.x", () => {
  assert.match(pkg.dependencies["@modelcontextprotocol/server"] ?? "", /^\^?2\./);
});

test("wrangler.jsonc declares the gateway's plain vars", () => {
  for (const name of ["MCP_OPERATOR_EMAIL", "MCP_EXECUTE_HOURLY_LIMIT"]) {
    assert.match(wrangler, new RegExp(`"${name}"\\s*:`), `${name} missing from vars`);
  }
});

test("the secret key is never a plain var", () => {
  assert.doesNotMatch(wrangler, /"MCP_PERPLEXITY_KEY"\s*:/);
});
