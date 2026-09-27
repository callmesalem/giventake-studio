// The real McpDeps, from the same layers the dashboard uses. App-only imports;
// tests never load this file (they read it as text, tests/mcp-deps.test.mjs).
import { CrmRead } from "@/server/crm/read";
import { CrmActions } from "@/server/crm/actions";
import { crmExecutorDeps } from "@/server/approvals/deps";
import { createSupabaseMailStore } from "@/server/mail/store";
import type { McpDeps } from "@/server/mcp/types";

export const AGENT = "agent_perplexity";

export function crmMcpDeps(env: NodeJS.ProcessEnv = process.env): McpDeps {
  const url = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "CRM rpc unconfigured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  const config = { url, serviceRoleKey };
  const parsedLimit = Number(env.MCP_EXECUTE_HOURLY_LIMIT ?? "20");
  return {
    // Admin actor: the gateway is Salem's, and MEMBER_TABLE_POLICY never applies.
    read: new CrmRead({ ...config, actor: { id: null, isAdmin: true } }),
    // The header that makes the database guard see Perplexity, not the dashboard.
    actions: new CrmActions({ ...config, actingAgent: AGENT }),
    // The executor runs the APPROVED action as the app, exactly as the approvals
    // page does; the decision itself went through the guard as the agent.
    executor: crmExecutorDeps(config),
    mail: createSupabaseMailStore(config),
    config: {
      agent: AGENT,
      operatorEmail: env.MCP_OPERATOR_EMAIL ?? "",
      executeHourlyLimit:
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 20,
    },
    now: () => new Date(),
  };
}
