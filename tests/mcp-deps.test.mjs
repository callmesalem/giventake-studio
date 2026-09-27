// Two rules that only text can pin: the real wiring names the agent on its
// CrmActions (so every write carries the header), and the wrapper turns thrown
// errors into fenced failures rather than protocol errors.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { defineTool } from "../src/server/mcp/tool.ts";
import { ToolRefusal } from "../src/server/mcp/result.ts";

const parse = (result) => JSON.parse(result.content[0].text);

test("crmMcpDeps constructs CrmActions with actingAgent set to agent_perplexity", () => {
  const source = readFileSync("src/server/mcp/deps.ts", "utf8");
  assert.match(source, /actingAgent:\s*AGENT/);
  assert.match(source, /export const AGENT = "agent_perplexity"/);
});

test("defineTool validates arguments before touching deps", async () => {
  let touched = false;
  const tool = defineTool(
    () => {
      touched = true;
      return {};
    },
    {
      name: "t",
      description: "d",
      readOnly: true,
      inputSchema: z.object({ id: z.uuid() }),
      run: async () => ({ fine: true }),
    },
  );
  const result = await tool.handler({ id: "nope" });
  assert.equal(result.isError, true);
  assert.match(parse(result).error, /id/);
  assert.equal(touched, false);
});

test("defineTool returns ok(data) on success and fail(explain(e)) on a throw", async () => {
  const good = defineTool(() => ({}), {
    name: "g",
    description: "d",
    readOnly: true,
    inputSchema: z.object({}),
    run: async () => ({ n: 1 }),
  });
  assert.deepEqual(parse(await good.handler({})).data, { n: 1 });

  const bad = defineTool(() => ({}), {
    name: "b",
    description: "d",
    readOnly: false,
    inputSchema: z.object({}),
    run: async () => {
      throw new ToolRefusal("Close is a proposal.");
    },
  });
  const result = await bad.handler({});
  assert.equal(result.isError, true);
  assert.equal(parse(result).error, "Close is a proposal.");
});

test("defineTool reports an unconfigured gateway when getDeps throws", async () => {
  const tool = defineTool(
    () => {
      throw new Error("CRM rpc unconfigured: no SUPABASE_URL");
    },
    {
      name: "u",
      description: "d",
      readOnly: true,
      inputSchema: z.object({}),
      run: async () => ({}),
    },
  );
  assert.match(parse(await tool.handler({})).error, /not configured/);
});
