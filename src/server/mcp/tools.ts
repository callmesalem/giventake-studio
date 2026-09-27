// src/server/mcp/tools.ts
import { readTools } from "./tools-read.ts";
import { writeTools } from "./tools-write.ts";
import { approvalTools } from "./tools-approvals.ts";
import type { McpDeps, ToolSpec } from "./types.ts";

export function allTools(getDeps: () => McpDeps): ToolSpec[] {
  const tools = [...readTools(getDeps), ...writeTools(getDeps), ...approvalTools(getDeps)];
  const names = new Set<string>();
  for (const t of tools) {
    if (names.has(t.name)) throw new Error(`duplicate MCP tool name ${t.name}`);
    names.add(t.name);
  }
  return tools;
}
