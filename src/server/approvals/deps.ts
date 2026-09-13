/**
 * The real ExecutorDeps, built from CrmRead and CrmActions.
 *
 * Separate from execute.ts so the dispatcher stays testable with a fake. This
 * module is the only place that knows the executor talks to Postgres at all.
 */
import { CrmRead } from "@/server/crm/read";
import { CrmActions } from "@/server/crm/actions";
import type { ExecutorDeps, StoredApproval } from "@/server/approvals/execute";

export function crmExecutorDeps(config: { url: string; serviceRoleKey: string }): ExecutorDeps {
  // Admin actor by construction, and the access control is NOT here: it is
  // requireAdmin in decideCrmApproval, which is this module's only caller.
  // MEMBER_TABLE_POLICY does not protect this path, because this reader never
  // carries a member actor for #scope to filter on. Do not remove that gate on
  // the belief that scoping would catch it.
  const read = new CrmRead({ ...config, actor: { id: null, isAdmin: true } });
  const actions = new CrmActions(config);

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
  };
}
