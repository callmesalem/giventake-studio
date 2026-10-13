/**
 * The real ExecutorDeps, built from CrmRead, CrmActions, the intake mailer and
 * the demo-site store.
 *
 * Separate from execute.ts so the dispatcher stays testable with a fake. This
 * module is the only place that knows the executor talks to Postgres at all.
 */
import { CrmRead } from "@/server/crm/read";
import { CrmActions } from "@/server/crm/actions";
import { createSupabaseDemoSiteStore } from "@/server/demo-sites/store";
import { sendMail } from "@/lib/intake";
import type { ExecutorDeps, StoredApproval } from "@/server/approvals/execute";

const FALLBACK_REPLY_TO = "build@giventakedevs.com";

export function crmExecutorDeps(config: { url: string; serviceRoleKey: string }): ExecutorDeps {
  // Admin actor by construction, and the access control is NOT here: this
  // module has two callers, each gated before it runs. decideCrmApproval
  // (src/lib/crm-data.ts) sits behind requireAdmin. The MCP execute tool
  // (src/server/mcp/tools-approvals.ts) sits behind the MCP_PERPLEXITY_KEY
  // and the approval_decide capability, checked when it decides the approval
  // just before calling executeApproval with this module's deps.
  // MEMBER_TABLE_POLICY does not protect this path, because this reader never
  // carries a member actor for #scope to filter on. Do not remove that gate on
  // the belief that scoping would catch it.
  const read = new CrmRead({ ...config, actor: { id: null, isAdmin: true } });
  const actions = new CrmActions(config);
  const demos = createSupabaseDemoSiteStore(config);

  return {
    async getApproval(id: string): Promise<StoredApproval | null> {
      const row = await read.getById<Record<string, unknown>>(
        "approval_queue",
        id,
        "id,action_type,agent_name,target_type,target_id,status,proposed_payload",
      );
      if (!row) return null;
      return {
        id: String(row.id),
        actionType: typeof row.action_type === "string" ? row.action_type : null,
        agentName: typeof row.agent_name === "string" ? row.agent_name : null,
        targetType: typeof row.target_type === "string" ? row.target_type : null,
        targetId: typeof row.target_id === "string" ? row.target_id : null,
        status: String(row.status),
        payload: row.proposed_payload,
      };
    },

    advanceDealStage: (input) => actions.advanceDealStage(input),

    markExecuted: async (id, result) => {
      await actions.markApprovalExecuted(id, result);
    },

    async recipientFor(targetType, targetId) {
      // leads is RPC-only for the service role; contacts allows a direct read.
      const row =
        targetType === "lead"
          ? await read.getLead<{ email?: unknown }>(targetId)
          : await read.getById<{ email?: unknown }>("contacts", targetId, "id,email");
      if (!row) return null;
      return { email: typeof row.email === "string" ? row.email : null };
    },

    isSuppressed: (address) => read.isSuppressed(address),

    outboundControl: () => read.systemControl<{ outboundEnabled?: boolean; reason?: string }>(),

    // Replies go to the studio mailbox, not to the agent. sendMail brands the
    // message the same way every other transactional send is branded.
    sendEmail: ({ to, subject, text }) =>
      sendMail(to, subject, text, process.env.INTAKE_TO_EMAIL ?? FALLBACK_REPLY_TO),

    async demoSiteFacts(targetType, targetId) {
      const table = targetType === "deal" ? "deals" : "companies";
      const row = await read.getById<{ id?: unknown }>(table, targetId, "id");
      if (!row) return { exists: false, existingStatuses: [] };
      const existing =
        targetType === "deal"
          ? await demos.listForDeal(targetId)
          : await demos.listForCompany(targetId);
      return { exists: true, existingStatuses: existing.map((d) => String(d.status)) };
    },

    requestDemoSite: (input) => demos.requestDemoSite({ ...input, requestedBy: null }),
  };
}
