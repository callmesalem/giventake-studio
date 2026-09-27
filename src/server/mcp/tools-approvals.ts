// src/server/mcp/tools-approvals.ts
// The "propose, then do when Salem says" tier. Spec sections 3 and 4.
//
// Two calls, never one: execute acts only on a row an earlier propose created.
// The decision goes through approval_decide AS THE AGENT (guarded by the
// approval_decide capability); the execution then runs through the same
// executor the approvals page uses. Phase 1 can execute deal_close only; every
// other action may be proposed and waits for a human on the approvals page.
import { z } from "zod";
import { RISK_LEVELS, type RiskLevel } from "../../lib/approvals.ts";
import { executeApproval, type ExecutionOutcome } from "../approvals/execute.ts";
import { defineTool } from "./tool.ts";
import { ToolRefusal } from "./result.ts";
import type { McpDeps, ToolInput, ToolSpec } from "./types.ts";

export const PROPOSABLE_ACTIONS = new Set([
  "deal_close",
  "send_email",
  "send_sms",
  "site_publish",
  "lead_set_status",
  "crm_assign",
  "deal_link_lead",
  "client_create",
  "project_create",
  "invoice_create",
  "document_request_signature",
]);

/** Extended one action per phase as its executor lands (spec section 3). */
export const EXECUTABLE_NOW = new Set(["deal_close"]);

const DEFAULT_RISK: Record<string, RiskLevel> = {
  send_email: "high",
  send_sms: "high",
  deal_close: "high",
  site_publish: "high",
};
const EXPIRY_HOURS = 72;
const APPROVAL_COLUMNS =
  "id,agent_name,action_type,target_type,target_id,summary,proposed_payload,risk_level,status,requested_at,expires_at,decided_at,decided_by,decision_reason,execution_result";

export function describeOutcome(outcome: ExecutionOutcome): string {
  if (outcome.ok) {
    return outcome.recorded === false
      ? `Done: ${outcome.action} was carried out, but recording it failed; check the approvals page.`
      : `Done: the deal was closed and the approval is recorded as executed.`;
  }
  switch (outcome.reason) {
    case "not-found":
      return "No such approval.";
    case "not-approved":
      return `The approval is ${outcome.status}, so nothing was executed.`;
    case "not-executable":
      return `The CRM cannot carry out ${outcome.actionType} yet; it stays for a human.`;
    case "refused":
      return `Refused: ${outcome.detail}`;
    default:
      return "Unknown outcome.";
  }
}

export function approvalTools(getDeps: () => McpDeps): ToolSpec[] {
  const define = <S extends ToolInput>(d: Parameters<typeof defineTool<S>>[1]) =>
    defineTool(getDeps, d);

  return [
    define({
      name: "propose",
      description:
        "File a proposal in the approval queue for anything outward or human-only (send_email, deal_close, lead_set_status, invoice_create, …). Nothing happens until Salem decides. If Salem then tells you to do it, call execute with the returned approval_id.",
      readOnly: false,
      inputSchema: z.object({
        action_type: z.string().min(1).max(40),
        target_type: z.string().min(1).max(40),
        target_id: z.string().min(1).max(80),
        summary: z.string().trim().min(3).max(500),
        payload: z.record(z.string(), z.unknown()).default({}),
        risk_level: z.string().optional(),
      }),
      run: async ({ action_type, target_type, target_id, summary, payload, risk_level }, deps) => {
        if (!PROPOSABLE_ACTIONS.has(action_type)) {
          throw new ToolRefusal(
            `"${action_type}" is not something that can be proposed. Money changes (pricing, refunds, scope) have no proposal path by design.`,
          );
        }
        const risk = risk_level ?? DEFAULT_RISK[action_type] ?? "medium";
        if (!(RISK_LEVELS as readonly string[]).includes(risk)) {
          throw new ToolRefusal(`risk_level must be one of ${RISK_LEVELS.join(", ")}.`);
        }
        const expiresAt = new Date(deps.now().getTime() + EXPIRY_HOURS * 3_600_000).toISOString();
        const approval_id = await deps.actions.requestApproval({
          agentName: deps.config.agent,
          actionType: action_type,
          targetType: target_type,
          targetId: target_id,
          summary,
          payload,
          riskLevel: risk,
          expiresAt,
        });
        const executable_now = EXECUTABLE_NOW.has(action_type);
        return {
          approval_id,
          action_type,
          risk_level: risk,
          expires_at: expiresAt,
          executable_now,
          note: executable_now
            ? "Queued. If Salem tells you to do it, call execute with this approval_id and his exact words."
            : "Queued for a human on the CRM approvals page. The CRM cannot carry this action out from here yet.",
        };
      },
    }),

    define({
      name: "list_approvals",
      description: "Approval queue rows by status (default pending), newest first.",
      readOnly: true,
      inputSchema: z.object({
        status: z
          .enum(["pending", "approved", "rejected", "expired", "executed"])
          .default("pending"),
      }),
      run: async ({ status }, deps) => {
        const approvals = await deps.read.listApprovals(status);
        return { status, count: approvals.length, approvals };
      },
    }),

    define({
      name: "get_approval",
      description: "One approval queue row in full, including its decision and execution result.",
      readOnly: true,
      inputSchema: z.object({ approval_id: z.uuid() }),
      run: async ({ approval_id }, deps) => {
        const approval = await deps.read.getById("approval_queue", approval_id, APPROVAL_COLUMNS);
        return approval ? { found: true, approval } : { found: false };
      },
    }),

    define({
      name: "execute",
      description:
        "Carry out a PENDING approval because Salem told you to, in his words. Only call this when Salem has directed it in this conversation. Records the decision as Salem acting through this connector, then runs the same executor the approvals page uses.",
      readOnly: false,
      inputSchema: z.object({
        approval_id: z.uuid(),
        instruction: z.string().trim().min(3).max(200),
      }),
      run: async ({ approval_id, instruction }, deps) => {
        const row = await deps.executor.getApproval(approval_id);
        if (!row) throw new ToolRefusal("No approval with that id. Propose first, then execute.");
        if (row.status !== "pending")
          throw new ToolRefusal(
            `That approval is ${row.status}, not pending, so there is nothing to execute.`,
          );
        if (!row.actionType || !EXECUTABLE_NOW.has(row.actionType)) {
          throw new ToolRefusal(
            `The CRM cannot carry out ${row.actionType ?? "this action"} from here yet; it stays pending for a human on the approvals page.`,
          );
        }
        const decidedBy = `crm:${deps.config.operatorEmail} via ${deps.config.agent}`;
        const since = new Date(deps.now().getTime() - 3_600_000).toISOString();
        const limit = deps.config.executeHourlyLimit;
        const recent = await deps.read.listWhere(
          "approval_queue",
          { decided_by: `eq.${decidedBy}`, decided_at: `gte.${since}` },
          "id",
          "decided_at.desc",
          limit + 1,
        );
        if (recent.length >= limit) {
          throw new ToolRefusal(
            `Directed executions are limited to ${limit} per hour, and that limit is reached. Salem can approve it on the CRM approvals page instead.`,
          );
        }
        await deps.actions.decideApproval(
          approval_id,
          "approved",
          decidedBy,
          `directed: "${instruction}"`,
        );
        const outcome = await executeApproval(deps.executor, approval_id, decidedBy, deps.now());
        return {
          approval_id,
          decided_by: decidedBy,
          instruction,
          outcome,
          outcome_text: describeOutcome(outcome),
        };
      },
    }),
  ];
}
