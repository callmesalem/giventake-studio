// The public one-tool MCP server on the marketing host. It can do exactly what
// the free site check form can do, attributed as itself, and nothing else.
import test from "node:test";
import assert from "node:assert/strict";
import {
  requestSiteCheckTool,
  createPublicServer,
  PUBLIC_SOURCE_DETAIL,
  PUBLIC_CONSENT_TEXT,
} from "../src/server/mcp/public-server.ts";

const parse = (result) => JSON.parse(result.content[0].text);

function harness({ result = { status: "sent" }, throws = false } = {}) {
  const calls = [];
  const tool = requestSiteCheckTool(async (data, sourceDetail) => {
    calls.push({ data, sourceDetail });
    if (throws) throw new Error("db down for ana@example.com");
    return result;
  });
  return { tool, calls };
}

const good = {
  name: "Ana",
  email: "ana@example.com",
  website: "https://anas-patios.com",
  consent: true,
};

test("files the request as the public tool with the agent's consent assertion recorded", async () => {
  const { tool, calls } = harness();
  const out = parse(await tool.handler(good));
  assert.equal(out.data.requested, true);
  assert.deepEqual(calls, [
    {
      data: {
        name: "Ana",
        email: "ana@example.com",
        website: "https://anas-patios.com",
        consent_given: true,
        consent_text: PUBLIC_CONSENT_TEXT,
      },
      sourceDetail: PUBLIC_SOURCE_DETAIL,
    },
  ]);
});

test("refuses without consent, before anything is recorded", async () => {
  for (const consent of [false, undefined, "yes"]) {
    const { tool, calls } = harness();
    const result = await tool.handler({ ...good, consent });
    assert.equal(result.isError, true);
    assert.match(parse(result).error, /consent/);
    assert.equal(calls.length, 0);
  }
});

test("refuses a bad address and never echoes it back", async () => {
  const { tool, calls } = harness();
  const result = await tool.handler({ ...good, email: "not-an-address" });
  assert.equal(result.isError, true);
  assert.match(parse(result).error, /email/);
  assert.doesNotMatch(result.content[0].text, /not-an-address/);
  assert.equal(calls.length, 0);
});

test("an unconfigured or failed send is an error that names the fallback mailbox", async () => {
  for (const result of [{ status: "unconfigured" }, { status: "error", message: "x" }]) {
    const { tool } = harness({ result });
    const out = await tool.handler(good);
    assert.equal(out.isError, true);
    assert.match(parse(out).error, /build@giventakedevs\.com/);
  }
});

test("a throw from the intake path never leaks what it said", async () => {
  const { tool } = harness({ throws: true });
  const out = await tool.handler(good);
  assert.equal(out.isError, true);
  assert.doesNotMatch(out.content[0].text, /example\.com/);
});

test("the server builds with the one tool registered", () => {
  const server = createPublicServer(async () => ({ status: "sent" }));
  assert.ok(server);
});
