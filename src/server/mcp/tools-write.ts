// src/server/mcp/tools-write.ts
// The "do directly" tier: the guarded internal writes. Each needs its
// agent_capabilities row on; the database says no otherwise, and explain()
// relays which row. Nothing here sends, deploys or moves money.
import { z } from "zod";
import { isCloseStage } from "../../lib/crm-guards.ts";
import { defineTool } from "./tool.ts";
import { ToolRefusal } from "./result.ts";
import type { McpDeps, ToolInput, ToolSpec } from "./types.ts";

const key = () => crypto.randomUUID();
const recordKey = z.string().min(1).max(80).optional();
const text = (max: number) => z.string().trim().min(1).max(max);
const CLOSE_REFUSAL_MESSAGE =
  "Close is a proposal, not a direct write: propose a deal_close and Salem decides.";

export function writeTools(getDeps: () => McpDeps): ToolSpec[] {
  const define = <S extends ToolInput>(d: Parameters<typeof defineTool<S>>[1]) =>
    defineTool(getDeps, d);

  return [
    define({
      name: "note_add",
      description:
        "Add a note, optionally against a company or a lead. Attributed to this connector.",
      readOnly: false,
      inputSchema: z.object({
        content: text(5000),
        title: z.string().trim().max(200).optional(),
        company_id: z.uuid().optional(),
        lead_id: z.uuid().optional(),
      }),
      run: async ({ content, title, company_id, lead_id }, deps) => {
        const record_key = key();
        await deps.actions.upsertNote({
          source: deps.config.agent,
          sourceRecordId: record_key,
          companyId: company_id ?? null,
          leadId: lead_id ?? null,
          title: title ?? null,
          content,
        });
        return { ok: true, record_key };
      },
    }),

    define({
      name: "task_upsert",
      description: "Create a task, or update one you created earlier by passing its record_key.",
      readOnly: false,
      inputSchema: z.object({
        content: text(2000),
        record_key: recordKey,
        company_id: z.uuid().optional(),
        deadline_at: z.string().datetime().optional(),
        is_completed: z.boolean().default(false),
      }),
      run: async ({ content, record_key, company_id, deadline_at, is_completed }, deps) => {
        const sourceRecordId = record_key ?? key();
        await deps.actions.upsertTask({
          source: deps.config.agent,
          sourceRecordId,
          companyId: company_id ?? null,
          content,
          isCompleted: is_completed,
          deadlineAt: deadline_at ?? null,
        });
        return { ok: true, record_key: sourceRecordId };
      },
    }),

    define({
      name: "company_upsert",
      description: "Create a company, or update one you created earlier by passing its record_key.",
      readOnly: false,
      inputSchema: z.object({
        name: text(200),
        record_key: recordKey,
        domain: z.string().trim().max(200).optional(),
        description: z.string().trim().max(2000).optional(),
        employee_range: z.string().trim().max(40).optional(),
        location: z.string().trim().max(200).optional(),
      }),
      run: async ({ name, record_key, domain, description, employee_range, location }, deps) => {
        const sourceRecordId = record_key ?? key();
        await deps.actions.upsertCompany({
          source: deps.config.agent,
          sourceRecordId,
          name,
          domain: domain ?? null,
          description: description ?? null,
          employeeRange: employee_range ?? null,
          location: location ?? null,
        });
        return { ok: true, record_key: sourceRecordId };
      },
    }),

    define({
      name: "contact_upsert",
      description: "Create a contact, or update one you created earlier by passing its record_key.",
      readOnly: false,
      inputSchema: z.object({
        name: text(200),
        record_key: recordKey,
        company_id: z.uuid().optional(),
        email: z.string().email().optional(),
        phone: z.string().trim().max(40).optional(),
        job_title: z.string().trim().max(120).optional(),
      }),
      run: async ({ name, record_key, company_id, email, phone, job_title }, deps) => {
        const sourceRecordId = record_key ?? key();
        await deps.actions.upsertContact({
          source: deps.config.agent,
          sourceRecordId,
          companyId: company_id ?? null,
          name,
          email: email ?? null,
          phone: phone ?? null,
          jobTitle: job_title ?? null,
        });
        return { ok: true, record_key: sourceRecordId };
      },
    }),

    define({
      name: "deal_upsert",
      description:
        "Create a deal, or update one you created earlier by passing its record_key. Stage changes on existing deals go through deal_advance_stage. Close is not allowed here: propose deal_close instead.",
      readOnly: false,
      inputSchema: z.object({
        name: text(200),
        record_key: recordKey,
        company_id: z.uuid().optional(),
        stage: z.string().trim().max(40).optional(),
        value_usd: z.number().min(0).max(100_000_000).optional(),
      }),
      run: async ({ name, record_key, company_id, stage, value_usd }, deps) => {
        if (stage && isCloseStage(stage)) {
          throw new ToolRefusal(CLOSE_REFUSAL_MESSAGE);
        }
        const sourceRecordId = record_key ?? key();
        await deps.actions.upsertDeal({
          source: deps.config.agent,
          sourceRecordId,
          companyId: company_id ?? null,
          name,
          stage: stage ?? null,
          valueUsd: value_usd ?? null,
        });
        return { ok: true, record_key: sourceRecordId };
      },
    }),

    define({
      name: "deal_advance_stage",
      description:
        "Move a deal to another stage with a note saying why. Close is not allowed here: propose deal_close instead.",
      readOnly: false,
      inputSchema: z.object({ deal_id: z.uuid(), to_stage: text(40), note: text(2000) }),
      run: async ({ deal_id, to_stage, note }, deps) => {
        if (isCloseStage(to_stage)) {
          throw new ToolRefusal(CLOSE_REFUSAL_MESSAGE);
        }
        await deps.actions.advanceDealStage({
          dealId: deal_id,
          toStage: to_stage,
          note,
          actor: deps.config.agent,
        });
        return { ok: true, deal_id, stage: to_stage };
      },
    }),

    define({
      name: "referral_partner_upsert",
      description: "Create or update a referral partner.",
      readOnly: false,
      inputSchema: z.object({
        name: text(200),
        partner_id: z.uuid().optional(),
        kind: z.string().trim().max(40).optional(),
        contact_email: z.string().email().optional(),
        notes: z.string().trim().max(2000).optional(),
      }),
      run: async ({ name, partner_id, kind, contact_email, notes }, deps) => {
        await deps.actions.upsertReferralPartner({
          id: partner_id ?? null,
          name,
          kind: kind ?? null,
          contactEmail: contact_email ?? null,
          notes: notes ?? null,
        });
        return { ok: true };
      },
    }),

    define({
      name: "referral_record",
      description: "Record that a partner referred a company.",
      readOnly: false,
      inputSchema: z.object({
        partner_id: z.uuid(),
        company_name: text(200),
        lead_id: z.uuid().optional(),
      }),
      run: async ({ partner_id, company_name, lead_id }, deps) => {
        await deps.actions.recordReferral({
          partnerId: partner_id,
          companyName: company_name,
          leadId: lead_id ?? null,
        });
        return { ok: true };
      },
    }),

    define({
      name: "referral_set_status",
      description: "Set a referral's status.",
      readOnly: false,
      inputSchema: z.object({ referral_id: z.uuid(), status: text(40) }),
      run: async ({ referral_id, status }, deps) => {
        await deps.actions.setReferralStatus(referral_id, status);
        return { ok: true };
      },
    }),
  ];
}
