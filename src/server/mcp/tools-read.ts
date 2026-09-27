// src/server/mcp/tools-read.ts
// The "see" tier. Reads are not capability-gated (capability design, 2026-09-06),
// so these need only a valid key. Every list excludes synthetic rows, as the
// edge function's did.
import { z } from "zod";
import { defineTool } from "./tool.ts";
import { ToolRefusal } from "./result.ts";
import type { McpDeps, ToolInput, ToolSpec } from "./types.ts";

const NOT_SYNTHETIC = { synthetic: "eq.false" } as const;
const LEAD_COLUMNS =
  "id,name,email,company,budget,timeline,source,source_detail,status,description,attribution,captured_at,created_at";

const limit = (def: number, max: number) =>
  z
    .number()
    .int()
    .min(1)
    .default(def)
    .transform((n) => Math.min(n, max));

/** Letters, digits, space, @ . _ ' - only: PostgREST's or=(…) filter would read
 *  a comma or a parenthesis as syntax. Capped at 60 characters. */
export function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[^\p{L}\p{N} @._'-]/gu, "")
    .trim()
    .slice(0, 60);
}

type Row = Record<string, unknown>;

export function readTools(getDeps: () => McpDeps): ToolSpec[] {
  const define = <S extends ToolInput>(d: Parameters<typeof defineTool<S>>[1]) =>
    defineTool(getDeps, d);

  return [
    define({
      name: "pipeline_summary",
      description:
        "Where the business stands right now: deals grouped by stage with their total value, leads grouped by status, open task count, and the pipeline's stage list. Start here for any 'how is business' question.",
      readOnly: true,
      inputSchema: z.object({}),
      run: async (_args, deps) => {
        const [deals, leads, tasks, stages] = await Promise.all([
          deps.read.listWhere<Row>(
            "deals",
            NOT_SYNTHETIC,
            "stage,value_usd",
            "created_at.desc",
            1000,
          ),
          deps.read.listWhere<Row>("leads", NOT_SYNTHETIC, "status", "created_at.desc", 1000),
          deps.read.listWhere<Row>("tasks", NOT_SYNTHETIC, "is_completed", "created_at.desc", 1000),
          deps.read.listStages<Row>(),
        ]);
        const byStage: Record<string, { deals: number; value_usd: number }> = {};
        let total = 0;
        for (const d of deals) {
          const key = typeof d.stage === "string" && d.stage ? d.stage : "(no stage)";
          const value = Number(d.value_usd ?? 0) || 0;
          byStage[key] ??= { deals: 0, value_usd: 0 };
          byStage[key].deals += 1;
          byStage[key].value_usd = Math.round((byStage[key].value_usd + value) * 100) / 100;
          total += value;
        }
        const byStatus: Record<string, number> = {};
        for (const l of leads) {
          const key = typeof l.status === "string" && l.status ? l.status : "(no status)";
          byStatus[key] = (byStatus[key] ?? 0) + 1;
        }
        return {
          deals_by_stage: byStage,
          total_deal_value_usd: Math.round(total * 100) / 100,
          leads_by_status: byStatus,
          open_tasks: tasks.filter((t) => t.is_completed !== true).length,
          stages,
          note: "Counts exclude synthetic records.",
        };
      },
    }),

    define({
      name: "list_leads",
      description:
        "Recent enquiries, newest first, with budget, timeline, source, status and attribution. Optional exact status filter.",
      readOnly: true,
      inputSchema: z.object({
        status: z.string().min(1).max(40).optional(),
        limit: limit(20, 100),
      }),
      run: async ({ status, limit: n }, deps) => {
        const filters: Record<string, string> = { ...NOT_SYNTHETIC };
        if (status) filters.status = `eq.${status}`;
        const leads = await deps.read.listWhere<Row>(
          "leads",
          filters,
          LEAD_COLUMNS,
          "created_at.desc",
          n,
        );
        return { count: leads.length, leads };
      },
    }),

    define({
      name: "get_lead",
      description:
        "One lead in full, with every note and touchpoint logged against it. Look up by lead_id or by email.",
      readOnly: true,
      inputSchema: z.object({ lead_id: z.uuid().optional(), email: z.string().email().optional() }),
      run: async ({ lead_id, email }, deps) => {
        if (!lead_id && !email) throw new ToolRefusal("Give either lead_id or email.");
        let lead: Row | null = null;
        if (lead_id) {
          lead = await deps.read.getById<Row>("leads", lead_id, "*");
        } else if (email) {
          const wanted = email.toLowerCase();
          const candidates = await deps.read.searchIn<Row>(
            "leads",
            ["email"],
            sanitizeSearchTerm(email),
            "*",
            10,
          );
          lead = candidates.find((c) => String(c.email ?? "").toLowerCase() === wanted) ?? null;
        }
        if (!lead || lead.synthetic === true)
          return { found: false, note: "No lead matches in the CRM." };
        const id = String(lead.id);
        const [notes, touchpoints] = await Promise.all([
          deps.read.relatedBy<Row>("notes", "lead_id", id, "title,content,created_at"),
          deps.read.relatedBy<Row>("touchpoints", "lead_id", id, "kind,content,created_at"),
        ]);
        return { found: true, lead, notes, touchpoints };
      },
    }),

    define({
      name: "list_companies",
      description: "Companies in the CRM, newest first, each with its contacts.",
      readOnly: true,
      inputSchema: z.object({ limit: limit(50, 200) }),
      run: async ({ limit: n }, deps) => {
        const companies = await deps.read.listWhere<Row>(
          "companies",
          NOT_SYNTHETIC,
          "id,name,domain,description,location,source,created_at,contacts(name,email,job_title)",
          "created_at.desc",
          n,
        );
        return { count: companies.length, companies };
      },
    }),

    define({
      name: "get_company",
      description: "One company with its contacts and deals.",
      readOnly: true,
      inputSchema: z.object({ company_id: z.uuid() }),
      run: async ({ company_id }, deps) => {
        const company = await deps.read.getById<Row>("companies", company_id, "*");
        if (!company || company.synthetic === true) return { found: false };
        const [contacts, deals] = await Promise.all([
          deps.read.relatedBy<Row>(
            "contacts",
            "company_id",
            company_id,
            "id,name,email,phone,job_title,lifecycle_stage,next_action,next_action_due",
          ),
          deps.read.relatedBy<Row>(
            "deals",
            "company_id",
            company_id,
            "id,name,stage,value_usd,closed_at,lost_reason,created_at",
          ),
        ]);
        return { found: true, company, contacts, deals };
      },
    }),

    define({
      name: "list_contacts",
      description: "Contacts, optionally for one company.",
      readOnly: true,
      inputSchema: z.object({ company_id: z.uuid().optional(), limit: limit(50, 200) }),
      run: async ({ company_id, limit: n }, deps) => {
        const filters: Record<string, string> = { ...NOT_SYNTHETIC };
        if (company_id) filters.company_id = `eq.${company_id}`;
        const contacts = await deps.read.listWhere<Row>(
          "contacts",
          filters,
          "id,name,email,phone,job_title,company_id,lifecycle_stage,next_action,next_action_due,created_at",
          "name.asc",
          n,
        );
        return { count: contacts.length, contacts };
      },
    }),

    define({
      name: "list_deals",
      description:
        "Deals with stage, value and company, newest first. Optional exact stage filter.",
      readOnly: true,
      inputSchema: z.object({ stage: z.string().min(1).max(40).optional(), limit: limit(50, 200) }),
      run: async ({ stage, limit: n }, deps) => {
        const filters: Record<string, string> = { ...NOT_SYNTHETIC };
        if (stage) filters.stage = `eq.${stage}`;
        const deals = await deps.read.listWhere<Row>(
          "deals",
          filters,
          "id,name,stage,value_usd,source,closed_at,lost_reason,created_at,companies(name,domain)",
          "created_at.desc",
          n,
        );
        return { count: deals.length, deals };
      },
    }),

    define({
      name: "get_deal",
      description: "One deal with its stage history and the documents on it.",
      readOnly: true,
      inputSchema: z.object({ deal_id: z.uuid() }),
      run: async ({ deal_id }, deps) => {
        const deal = await deps.read.getById<Row>("deals", deal_id, "*");
        if (!deal || deal.synthetic === true) return { found: false };
        const [stage_events, documents] = await Promise.all([
          deps.read.relatedBy<Row>("deal_stage_events", "deal_id", deal_id, "*"),
          deps.read.dealDocuments<Row>(deal_id),
        ]);
        return { found: true, deal, stage_events, documents };
      },
    }),

    define({
      name: "list_tasks",
      description:
        "Tasks with deadline and company, soonest deadline first. Overdue is computed against today; say 'overdue' only when the tool says so.",
      readOnly: true,
      inputSchema: z.object({
        include_completed: z.boolean().default(false),
        limit: limit(50, 200),
      }),
      run: async ({ include_completed, limit: n }, deps) => {
        const filters: Record<string, string> = { ...NOT_SYNTHETIC };
        if (!include_completed) filters.is_completed = "eq.false";
        const rows = await deps.read.listWhere<Row>(
          "tasks",
          filters,
          "id,content,is_completed,deadline_at,created_at,companies(name)",
          "deadline_at.asc.nullslast",
          n,
        );
        const today = deps.now().toISOString().slice(0, 10);
        const open = rows.filter((t) => t.is_completed !== true).length;
        const tasks = rows.map((t) => ({
          ...t,
          overdue:
            t.is_completed !== true &&
            typeof t.deadline_at === "string" &&
            t.deadline_at.slice(0, 10) < today,
        }));
        return {
          count: tasks.length,
          open,
          tasks,
        };
      },
    }),

    define({
      name: "recent_activity",
      description: "The most recent touchpoints and automated capture events, newest first.",
      readOnly: true,
      inputSchema: z.object({ limit: limit(25, 100) }),
      run: async ({ limit: n }, deps) => {
        const [touchpoints, agent_log] = await Promise.all([
          deps.read.listWhere<Row>(
            "touchpoints",
            NOT_SYNTHETIC,
            "kind,content,lead_id,created_at",
            "created_at.desc",
            n,
          ),
          deps.read.listWhere<Row>(
            "agent_log",
            NOT_SYNTHETIC,
            "operator,sop,step,trigger,outcome,escalated,created_at",
            "created_at.desc",
            n,
          ),
        ]);
        return { touchpoints, agent_log };
      },
    }),

    define({
      name: "search",
      description:
        "Find leads, companies, contacts and deals whose name, email or domain contains the text.",
      readOnly: true,
      inputSchema: z.object({ query: z.string().min(1).max(100) }),
      run: async ({ query }, deps) => {
        const term = sanitizeSearchTerm(query);
        if (term.length < 2)
          throw new ToolRefusal("Give at least two letters or digits to search for.");
        const [leads, companies, contacts, deals] = await Promise.all([
          deps.read.searchIn<Row>(
            "leads",
            ["name", "email", "company"],
            term,
            "id,name,email,company,status,created_at",
            10,
          ),
          deps.read.searchIn<Row>(
            "companies",
            ["name", "domain"],
            term,
            "id,name,domain,location",
            10,
          ),
          deps.read.searchIn<Row>(
            "contacts",
            ["name", "email"],
            term,
            "id,name,email,job_title,company_id",
            10,
          ),
          deps.read.searchIn<Row>(
            "deals",
            ["name"],
            term,
            "id,name,stage,value_usd,company_id",
            10,
          ),
        ]);
        const real = (rows: Row[]) => rows.filter((r) => r.synthetic !== true);
        return {
          term,
          leads: real(leads),
          companies: real(companies),
          contacts: real(contacts),
          deals: real(deals),
        };
      },
    }),

    define({
      name: "mail_inbox",
      description:
        "The connected mailbox's recent threads: subject, snippet, participants and links to CRM records. No message bodies exist in the CRM.",
      readOnly: true,
      inputSchema: z.object({ limit: limit(25, 50) }),
      run: async ({ limit: n }, deps) => {
        if (!deps.mail)
          throw new ToolRefusal("The mail surface is not available on this deployment.");
        const threads = (await deps.mail.listInbox(n, 0)) as Row[];
        return {
          count: threads.length,
          threads: threads.map((t) => ({
            id: t.id,
            subject: t.subject,
            snippet: t.snippet,
            participants: t.participants,
            message_count: t.messageCount,
            last_message_at: t.lastMessageAt,
            unread: t.unread,
            contact: t.contactName,
            deal: t.dealName,
            company: t.companyName,
            contact_id: t.contactId,
            deal_id: t.dealId,
            company_id: t.companyId,
          })),
        };
      },
    }),

    define({
      name: "system_status",
      description:
        "The agent kill switches and which of this connector's own capabilities are switched on. Check this when a write is refused.",
      readOnly: true,
      inputSchema: z.object({}),
      run: async (_args, deps) => {
        const [control, capabilities] = await Promise.all([
          deps.read.systemControl<{
            operatorsEnabled?: boolean;
            outboundEnabled?: boolean;
            reason?: string;
          }>(),
          deps.read.capabilitiesFor(deps.config.agent),
        ]);
        return {
          agent: deps.config.agent,
          operators_enabled: control?.operatorsEnabled === true,
          outbound_enabled: control?.outboundEnabled === true,
          reason: control?.reason ?? null,
          capabilities,
        };
      },
    }),
  ];
}
