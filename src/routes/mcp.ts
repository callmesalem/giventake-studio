import { createFileRoute } from "@tanstack/react-router";
import { authenticateMcpRequest, postgrestAuditClient } from "@/server/mcp/auth.ts";
import { crmMcpDeps } from "@/server/mcp/deps.ts";
import { gatewayHandler } from "@/server/mcp/server.ts";

/**
 * The Perplexity MCP gateway. Host and key first, then the SDK handler. The
 * dependency getter throws when the Supabase env is missing, and the tool
 * wrapper turns that into a plain "not configured" error, so `initialize` and
 * `tools/list` work with no environment (which is what the smoke test relies
 * on) while every tool call says exactly what is missing.
 */
async function handle(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const audit = url && key ? postgrestAuditClient({ url, serviceRoleKey: key }) : null;

  const auth = await authenticateMcpRequest(request, {
    expectedKey: process.env.MCP_PERPLEXITY_KEY,
    audit,
  });
  if (!auth.ok) return auth.response;

  return gatewayHandler(() => crmMcpDeps()).fetch(request);
}

const methodNotAllowed = () =>
  new Response(JSON.stringify({ error: "Use Streamable HTTP: POST JSON-RPC to this URL." }), {
    status: 405,
    headers: { "content-type": "application/json", allow: "POST" },
  });

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
      GET: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
});
