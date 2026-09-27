// src/server/mcp/types.ts
// The shapes every tools file, the server and the tests share. Relative imports
// only: tests load these modules with node --experimental-strip-types.
import type { z } from "zod";
import type { CrmActions } from "../crm/actions.ts";
import type { CrmRead } from "../crm/read.ts";
import type { ExecutorDeps } from "../approvals/execute.ts";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Every tool's input is a zod object, which the SDK converts to JSON Schema. */
export type ToolInput = z.ZodObject<z.ZodRawShape>;

export interface ToolSpec<S extends ToolInput = ToolInput> {
  name: string;
  description: string;
  inputSchema: S;
  /** True for tools that never write. Surfaced to the client as readOnlyHint. */
  readOnly: boolean;
  /** Takes RAW arguments; the wrapper in tool.ts validates them. */
  handler: (args: unknown) => Promise<ToolResult>;
}

export type McpReadPort = Pick<
  CrmRead,
  | "listWhere"
  | "getById"
  | "relatedBy"
  | "searchIn"
  | "listStages"
  | "systemControl"
  | "listApprovals"
  | "dealDocuments"
  | "capabilitiesFor"
>;

export type McpWritePort = Pick<
  CrmActions,
  | "upsertNote"
  | "upsertTask"
  | "upsertCompany"
  | "upsertContact"
  | "upsertDeal"
  | "advanceDealStage"
  | "upsertReferralPartner"
  | "recordReferral"
  | "setReferralStatus"
  | "decideApproval"
  | "requestApproval"
>;

export interface McpMailPort {
  listInbox(limit: number, offset: number): Promise<unknown[]>;
}

export interface McpConfig {
  /** Exactly "agent_perplexity" in production. */
  agent: string;
  /** The human the key belongs to, stamped on directed decisions. */
  operatorEmail: string;
  /** Directed executions per rolling hour. */
  executeHourlyLimit: number;
}

export interface McpDeps {
  read: McpReadPort;
  actions: McpWritePort;
  executor: ExecutorDeps;
  mail: McpMailPort | null;
  config: McpConfig;
  now: () => Date;
}
