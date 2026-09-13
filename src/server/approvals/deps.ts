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
  // Admin actor: approval_queue is admin_only in MEMBER_TABLE_POLICY, so a
  // member's read returns nothing and the executor refuses with not-found. That
  // is the correct outcome - a member has no business executing an approval -
  // and it is enforced by the same scoping every other surface uses.
  const read = new CrmRead({ ...config, actor: { id: null, isAdmin: true } });
  const actions = new CrmActions(config);

  return {
    async getApproval(id: string): Promise<StoredApproval | null> {
      const row = await read.getById<Record<string, unknown>>(
        "approval_queue",
        id,
        "id,action_type,target_type,target_id,status,proposed_payload",
      );
      if (!row) return null;
      return {
        id: String(row.id),
        actionType: typeof row.action_type === "string" ? row.action_type : null,
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
