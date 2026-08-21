/**
 * CRM dashboard data — TanStack Start server functions.
 *
 * Every function requires a valid session (throws 401 otherwise), then reads via
 * the server-only CrmRead layer with the service-role key. The key and the raw
 * Supabase responses never reach the browser: these functions return only the
 * shaped view models below.
 */
import { createServerFn } from "@tanstack/react-start";

function config() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Response("CRM database is not configured", { status: 503 });
  }
  return { url, serviceRoleKey };
}

/** Gate on a valid session, then return a server-only reader. Session check and
 * cookie access live in the .server module so this file stays client-safe. */
async function reader() {
  const { requireCrmSession } = await import("./crm-auth.server");
  await requireCrmSession();
  const { CrmRead } = await import("@/server/crm/read");
  return new CrmRead(config());
}

export interface CompanyRow {
  id: string;
  name: string;
  domain: string | null;
  location: string | null;
  employee_range: string | null;
  source: string | null;
}
export interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company: string | null;
}
export interface DealRow {
  id: string;
  name: string;
  stage: string | null;
  value_usd: number | null;
  company: string | null;
  source: string | null;
}
export interface ApprovalRow {
  id: string;
  agent_name: string | null;
  action_type: string | null;
  summary: string | null;
  risk_level: string | null;
  requested_at: string | null;
}
export interface LeadRow {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  status: string | null;
  source: string | null;
  budget: string | null;
  timeline: string | null;
  score: string | null;
  created_at: string | null;
}

/** Fully-serializable overview shape for the dashboard home. */
export interface OverviewVM {
  companies: number;
  contacts: number;
  deals: number;
  pendingApprovals: number;
  notes: number;
  tasks: number;
  openTasks: number;
  campaignsCount: number;
  enrollmentsByStatus: Record<string, number>;
  subscribersByStatus: Record<string, number>;
  issuesCount: number;
  referralsByStatus: Record<string, number>;
  partnersCount: number;
  reviewsByStatus: Record<string, number>;
  requestsByStatus: Record<string, number>;
}

function counts(record: Record<string, number> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(record ?? {})) out[k] = Number(v) || 0;
  return out;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length ? v : v == null ? null : String(v);
}
function num(v: unknown): number | null {
  return typeof v === "number" ? v : v == null ? null : Number(v);
}

export const crmOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<OverviewVM> => {
    const read = await reader();
    const o = await read.getOverview();
    return {
      companies: o.prospecting.companies,
      contacts: o.prospecting.contacts,
      deals: o.prospecting.deals,
      pendingApprovals: o.pendingApprovals,
      notes: o.activity.notes,
      tasks: o.activity.tasks,
      openTasks: o.activity.openTasks,
      campaignsCount: o.campaigns.campaigns.length,
      enrollmentsByStatus: counts(o.campaigns.enrollmentsByStatus),
      subscribersByStatus: counts(o.newsletter.subscribersByStatus),
      issuesCount: o.newsletter.issues.length,
      referralsByStatus: counts(o.referral.referralsByStatus),
      partnersCount: o.referral.partners.length,
      reviewsByStatus: counts(o.reputation.reviewsByStatus),
      requestsByStatus: counts(o.reputation.requestsByStatus),
    };
  },
);

export const crmCompanies = createServerFn({ method: "GET" }).handler(
  async (): Promise<CompanyRow[]> => {
    const read = await reader();
    const rows = await read.listCompanies<Record<string, unknown>>();
    return rows.map((r) => ({
      id: String(r.id),
      name: str(r.name) ?? "(unnamed)",
      domain: str(r.domain),
      location: str(r.location),
      employee_range: str(r.employee_range),
      source: str(r.source),
    }));
  },
);

export const crmContacts = createServerFn({ method: "GET" }).handler(
  async (): Promise<ContactRow[]> => {
    const read = await reader();
    const [contacts, companies] = await Promise.all([
      read.listContacts<Record<string, unknown>>(),
      read.listCompanies<Record<string, unknown>>(),
    ]);
    const nameById = new Map(companies.map((c) => [String(c.id), str(c.name)]));
    return contacts.map((r) => ({
      id: String(r.id),
      name: str(r.name) ?? "(unnamed)",
      email: str(r.email),
      phone: str(r.phone),
      job_title: str(r.job_title),
      company: r.company_id ? (nameById.get(String(r.company_id)) ?? null) : null,
    }));
  },
);

export const crmDeals = createServerFn({ method: "GET" }).handler(async (): Promise<DealRow[]> => {
  const read = await reader();
  const [deals, companies] = await Promise.all([
    read.listDeals<Record<string, unknown>>(),
    read.listCompanies<Record<string, unknown>>(),
  ]);
  const nameById = new Map(companies.map((c) => [String(c.id), str(c.name)]));
  return deals.map((r) => ({
    id: String(r.id),
    name: str(r.name) ?? "(unnamed)",
    stage: str(r.stage),
    value_usd: num(r.value_usd),
    company: r.company_id ? (nameById.get(String(r.company_id)) ?? null) : null,
    source: str(r.source),
  }));
});

export const crmLeads = createServerFn({ method: "GET" }).handler(async (): Promise<LeadRow[]> => {
  const read = await reader();
  const rows = await read.listLeads<Record<string, unknown>>();
  return rows.map((r) => ({
    id: String(r.id),
    name: str(r.name),
    email: str(r.email),
    company: str(r.company),
    status: str(r.status),
    source: str(r.source),
    budget: str(r.budget),
    timeline: str(r.timeline),
    score: str(r.score),
    created_at: str(r.created_at),
  }));
});

export interface DecideApprovalInput {
  id: string;
  decision: "approved" | "rejected";
  reason: string;
}

function validateDecide(data: DecideApprovalInput): DecideApprovalInput {
  const id = typeof data?.id === "string" ? data.id.trim() : "";
  const decision =
    data?.decision === "approved" ? "approved" : data?.decision === "rejected" ? "rejected" : null;
  const reason = typeof data?.reason === "string" ? data.reason.trim() : "";
  if (!/^[0-9a-fA-F-]{36}$/.test(id))
    throw new Response("Valid approval id required", { status: 400 });
  if (!decision) throw new Response("Decision must be approved or rejected", { status: 400 });
  if (reason.length < 3) throw new Response("A decision reason is required", { status: 400 });
  return { id, decision, reason };
}

export const decideCrmApproval = createServerFn({ method: "POST" })
  .validator(validateDecide)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCrmSession } = await import("./crm-auth.server");
    const session = await requireCrmSession();
    const { CrmActions } = await import("@/server/crm/actions");
    const actions = new CrmActions(config());
    await actions.decideApproval(data.id, data.decision, `crm:${session.email}`, data.reason);
    return { ok: true };
  });

export const crmApprovals = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApprovalRow[]> => {
    const read = await reader();
    const rows = await read.listPendingApprovals<Record<string, unknown>>();
    return rows.map((r) => ({
      id: String(r.id),
      agent_name: str(r.agent_name),
      action_type: str(r.action_type),
      summary: str(r.summary),
      risk_level: str(r.risk_level),
      requested_at: str(r.requested_at),
    }));
  },
);

/* ── Phase 01: record detail ────────────────────────────────────────────────
 *
 * One server function per record type. Each returns the record plus everything
 * attached to it, already shaped — the browser never sees a raw Supabase row.
 *
 * Ids are validated as UUIDs before they reach the read layer. PostgREST
 * filters are built by string concatenation, so an unvalidated id is an
 * injection surface; rejecting anything that is not a UUID closes it at the
 * boundary rather than trusting every call site to be careful.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(id: unknown): string {
  const value = typeof id === "string" ? id.trim() : "";
  if (!UUID.test(value)) throw new Response("Not found", { status: 404 });
  return value;
}

function notFound(record: unknown): asserts record is Record<string, unknown> {
  if (!record) throw new Response("Not found", { status: 404 });
}

/** A single thing that happened, from whichever table recorded it. */
export interface TimelineEvent {
  id: string;
  at: string | null;
  kind: "touchpoint" | "agent" | "note" | "stage" | "task";
  title: string;
  detail: string | null;
  actor: string | null;
}

const byNewestFirst = (a: TimelineEvent, b: TimelineEvent) =>
  (b.at ?? "").localeCompare(a.at ?? "");

/** Human label for a touchpoint kind: website_contact_form -> Website contact form. */
function humanise(value: string | null): string {
  if (!value) return "Activity";
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** jsonb columns arrive as objects; render something readable without dumping
 *  the whole blob at the user. */
function summarise(content: unknown, keys: string[]): string | null {
  if (!content || typeof content !== "object") return content ? String(content) : null;
  const record = content as Record<string, unknown>;
  const parts = keys
    .map((k) => {
      const v = record[k];
      return v === null || v === undefined || v === "" ? null : `${humanise(k)}: ${String(v)}`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

async function leadTimeline(
  read: Awaited<ReturnType<typeof reader>>,
  leadId: string,
): Promise<TimelineEvent[]> {
  const [touchpoints, log] = await Promise.all([
    read.relatedBy<Record<string, unknown>>(
      "touchpoints",
      "lead_id",
      leadId,
      "id,kind,content,created_at",
    ),
    read.relatedBy<Record<string, unknown>>(
      "agent_log",
      "lead_id",
      leadId,
      "id,operator,sop,step,outcome,escalated,created_at",
    ),
  ]);

  const events: TimelineEvent[] = [
    ...touchpoints.map((t) => ({
      id: `tp-${String(t.id)}`,
      at: str(t.created_at),
      kind: "touchpoint" as const,
      title: humanise(str(t.kind)),
      detail: summarise(t.content, ["source", "budget", "timeline", "company", "description"]),
      actor: null,
    })),
    ...log.map((l) => ({
      id: `al-${String(l.id)}`,
      at: str(l.created_at),
      kind: "agent" as const,
      title: `${humanise(str(l.step))}${l.escalated ? " — escalated" : ""}`,
      detail: [str(l.outcome), str(l.sop)].filter(Boolean).join(" · ") || null,
      actor: str(l.operator),
    })),
  ];
  return events.sort(byNewestFirst);
}

async function companyTimeline(
  read: Awaited<ReturnType<typeof reader>>,
  companyId: string,
): Promise<TimelineEvent[]> {
  const [notes, tasks] = await Promise.all([
    read.relatedBy<Record<string, unknown>>(
      "notes",
      "company_id",
      companyId,
      "id,title,content,source,created_at",
    ),
    read.relatedBy<Record<string, unknown>>(
      "tasks",
      "company_id",
      companyId,
      "id,content,is_completed,deadline_at,source,created_at",
    ),
  ]);

  const events: TimelineEvent[] = [
    ...notes.map((n) => ({
      id: `nt-${String(n.id)}`,
      at: str(n.created_at),
      kind: "note" as const,
      title: str(n.title) ?? "Note",
      detail: str(n.content),
      actor: str(n.source),
    })),
    ...tasks.map((t) => ({
      id: `tk-${String(t.id)}`,
      at: str(t.created_at),
      kind: "task" as const,
      title: t.is_completed ? "Task completed" : "Task",
      detail: str(t.content),
      actor: str(t.source),
    })),
  ];
  return events.sort(byNewestFirst);
}

export interface LeadDetail {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  status: string | null;
  source: string | null;
  source_detail: string | null;
  budget: string | null;
  timeline: string | null;
  description: string | null;
  qualification: string | null;
  consent_given: boolean | null;
  consent_at: string | null;
  consent_text: string | null;
  created_at: string | null;
  last_touch_at: string | null;
  events: TimelineEvent[];
}

export const crmLead = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => ({ id: requireUuid(data?.id) }))
  .handler(async ({ data }): Promise<LeadDetail> => {
    const read = await reader();
    const row = await read.getById<Record<string, unknown>>("leads", data.id);
    notFound(row);
    return {
      id: String(row.id),
      name: str(row.name),
      email: str(row.email),
      company: str(row.company),
      status: str(row.status),
      source: str(row.source),
      source_detail: str(row.source_detail),
      budget: str(row.budget),
      timeline: str(row.timeline),
      description: str(row.description),
      qualification: row.qualification ? JSON.stringify(row.qualification) : null,
      consent_given: typeof row.consent_given === "boolean" ? row.consent_given : null,
      consent_at: str(row.consent_at),
      consent_text: str(row.consent_text),
      created_at: str(row.created_at),
      last_touch_at: str(row.last_touch_at),
      events: await leadTimeline(read, data.id),
    };
  });

export interface CompanyDetail {
  id: string;
  name: string;
  domain: string | null;
  location: string | null;
  employee_range: string | null;
  description: string | null;
  source: string | null;
  created_at: string | null;
  contacts: { id: string; name: string; email: string | null; job_title: string | null }[];
  deals: { id: string; name: string; stage: string | null; value_usd: number | null }[];
  events: TimelineEvent[];
}

export const crmCompany = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => ({ id: requireUuid(data?.id) }))
  .handler(async ({ data }): Promise<CompanyDetail> => {
    const read = await reader();
    const row = await read.getById<Record<string, unknown>>("companies", data.id);
    notFound(row);
    const [contacts, deals, events] = await Promise.all([
      read.relatedBy<Record<string, unknown>>(
        "contacts",
        "company_id",
        data.id,
        "id,name,email,job_title",
        "name.asc",
      ),
      read.relatedBy<Record<string, unknown>>(
        "deals",
        "company_id",
        data.id,
        "id,name,stage,value_usd",
      ),
      companyTimeline(read, data.id),
    ]);
    return {
      id: String(row.id),
      name: str(row.name) ?? "(unnamed)",
      domain: str(row.domain),
      location: str(row.location),
      employee_range: str(row.employee_range),
      description: str(row.description),
      source: str(row.source),
      created_at: str(row.created_at),
      contacts: contacts.map((c) => ({
        id: String(c.id),
        name: str(c.name) ?? "(unnamed)",
        email: str(c.email),
        job_title: str(c.job_title),
      })),
      deals: deals.map((d) => ({
        id: String(d.id),
        name: str(d.name) ?? "(unnamed)",
        stage: str(d.stage),
        value_usd: num(d.value_usd),
      })),
      events,
    };
  });

export interface DealDetail {
  id: string;
  name: string;
  stage: string | null;
  value_usd: number | null;
  source: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  created_at: string | null;
  company: { id: string; name: string } | null;
  lead: { id: string; name: string | null; email: string | null } | null;
  stageGate: { artifact: string | null; gate: string | null } | null;
  events: TimelineEvent[];
}

export const crmDeal = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => ({ id: requireUuid(data?.id) }))
  .handler(async ({ data }): Promise<DealDetail> => {
    const read = await reader();
    const row = await read.getById<Record<string, unknown>>("deals", data.id);
    notFound(row);

    const companyId = row.company_id ? String(row.company_id) : null;
    const leadId = row.lead_id ? String(row.lead_id) : null;

    const [company, lead, stages, stageEvents, related] = await Promise.all([
      companyId
        ? read.getById<Record<string, unknown>>("companies", companyId, "id,name")
        : Promise.resolve(null),
      leadId
        ? read.getById<Record<string, unknown>>("leads", leadId, "id,name,email")
        : Promise.resolve(null),
      read.relatedBy<Record<string, unknown>>(
        "pipeline_stages",
        "name",
        String(row.stage ?? ""),
        "name,artifact,gate",
        "name.asc",
        1,
      ).catch(() => []),
      read.relatedBy<Record<string, unknown>>(
        "deal_stage_events",
        "deal_id",
        data.id,
        "id,from_stage,to_stage,actor,note,created_at",
      ).catch(() => []),
      companyId ? companyTimeline(read, companyId) : Promise.resolve([]),
    ]);

    const stageHistory: TimelineEvent[] = stageEvents.map((e) => ({
      id: `se-${String(e.id)}`,
      at: str(e.created_at),
      kind: "stage" as const,
      title: `${str(e.from_stage) ?? "—"} → ${str(e.to_stage) ?? "—"}`,
      detail: str(e.note),
      actor: str(e.actor),
    }));

    return {
      id: String(row.id),
      name: str(row.name) ?? "(unnamed)",
      stage: str(row.stage),
      value_usd: num(row.value_usd),
      source: str(row.source),
      closed_at: str(row.closed_at),
      lost_reason: str(row.lost_reason),
      created_at: str(row.created_at),
      company: company ? { id: String(company.id), name: str(company.name) ?? "(unnamed)" } : null,
      lead: lead
        ? { id: String(lead.id), name: str(lead.name), email: str(lead.email) }
        : null,
      stageGate: stages[0]
        ? { artifact: str(stages[0].artifact), gate: str(stages[0].gate) }
        : null,
      events: [...stageHistory, ...related].sort(byNewestFirst),
    };
  });

export interface ContactDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  created_at: string | null;
  company: { id: string; name: string } | null;
  events: TimelineEvent[];
}

export const crmContact = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => ({ id: requireUuid(data?.id) }))
  .handler(async ({ data }): Promise<ContactDetail> => {
    const read = await reader();
    const row = await read.getById<Record<string, unknown>>("contacts", data.id);
    notFound(row);
    const companyId = row.company_id ? String(row.company_id) : null;
    const [company, events] = await Promise.all([
      companyId
        ? read.getById<Record<string, unknown>>("companies", companyId, "id,name")
        : Promise.resolve(null),
      companyId ? companyTimeline(read, companyId) : Promise.resolve([]),
    ]);
    return {
      id: String(row.id),
      name: str(row.name) ?? "(unnamed)",
      email: str(row.email),
      phone: str(row.phone),
      job_title: str(row.job_title),
      created_at: str(row.created_at),
      company: company ? { id: String(company.id), name: str(company.name) ?? "(unnamed)" } : null,
      events,
    };
  });

export interface TaskRow {
  id: string;
  content: string;
  is_completed: boolean;
  deadline_at: string | null;
  source: string | null;
  company: string | null;
  created_at: string | null;
}

/** Tasks had no interface at all. Piper's escalations land here — until now they
 *  were only visible by querying Postgres directly. */
export const crmTasks = createServerFn({ method: "GET" }).handler(
  async (): Promise<TaskRow[]> => {
    const read = await reader();
    const [tasks, companies] = await Promise.all([
      read.listTasks<Record<string, unknown>>(),
      read.listCompanies<Record<string, unknown>>(),
    ]);
    const nameById = new Map(companies.map((c) => [String(c.id), str(c.name)]));
    return tasks.map((t) => ({
      id: String(t.id),
      content: str(t.content) ?? "",
      is_completed: Boolean(t.is_completed),
      deadline_at: str(t.deadline_at),
      source: str(t.source),
      company: t.company_id ? (nameById.get(String(t.company_id)) ?? null) : null,
      created_at: str(t.created_at),
    }));
  },
);

/* ── Phase 02: writes ───────────────────────────────────────────────────────
 *
 * Human edits go through the same *_upsert RPCs the agents use, so validation,
 * audit and RLS are shared rather than duplicated.
 *
 * The actor is always `crm:<email>`. Agent writes are stamped `agent:<name>`.
 * Keeping the prefixes distinct means the audit trail can always answer whether
 * a change came from a person or a process, which is the whole point of having
 * one.
 */

function text(value: unknown, field: string, max: number, required = false): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) {
    if (required) throw new Response(`${field} is required`, { status: 400 });
    return null;
  }
  if (s.length > max) throw new Response(`${field} is too long`, { status: 400 });
  return s;
}

function optionalUuid(id: unknown): string | null {
  if (id === null || id === undefined || id === "") return null;
  return requireUuid(id);
}

/** Session + write layer, gated identically to reads. */
async function writer() {
  const { requireCrmSession } = await import("./crm-auth.server");
  const session = await requireCrmSession();
  const { CrmActions } = await import("@/server/crm/actions");
  return { actions: new CrmActions(config()), actor: `crm:${session.email}` };
}

/** The upserts key on (source, source_record_id). For an EDIT we must reuse the
 *  row's existing pair or the upsert inserts a second row. Reading them back
 *  also preserves provenance: a company Piper sourced still says so after a
 *  human corrects it. */
async function identityFor(
  table: string,
  id: string | null,
): Promise<{ source: string; sourceRecordId: string }> {
  if (!id) {
    return { source: "crm", sourceRecordId: crypto.randomUUID() };
  }
  const read = await reader();
  const row = await read.getById<Record<string, unknown>>(table, id, "id,source,source_record_id");
  notFound(row);
  return {
    source: str(row.source) ?? "crm",
    // Older rows may predate source_record_id; fall back to the row id, which is
    // stable and unique, rather than minting a new key that would fork the row.
    sourceRecordId: str(row.source_record_id) ?? String(row.id),
  };
}

export const saveCompany = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    id: optionalUuid(d?.id),
    name: text(d?.name, "Name", 200, true) as string,
    domain: text(d?.domain, "Domain", 200),
    description: text(d?.description, "Description", 4000),
    location: text(d?.location, "Location", 200),
    employeeRange: text(d?.employeeRange, "Size", 60),
  }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { actions } = await writer();
    const identity = await identityFor("companies", data.id);
    await actions.upsertCompany({ ...identity, ...data });
    return { ok: true };
  });

export const saveContact = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    id: optionalUuid(d?.id),
    companyId: optionalUuid(d?.companyId),
    name: text(d?.name, "Name", 200, true) as string,
    email: text(d?.email, "Email", 255),
    phone: text(d?.phone, "Phone", 60),
    jobTitle: text(d?.jobTitle, "Role", 200),
  }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { actions } = await writer();
    const identity = await identityFor("contacts", data.id);
    await actions.upsertContact({ ...identity, ...data });
    return { ok: true };
  });

export const saveDeal = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => {
    const raw = d?.valueUsd;
    const valueUsd =
      raw === null || raw === undefined || raw === "" ? null : Number(raw);
    if (valueUsd !== null && (!Number.isFinite(valueUsd) || valueUsd < 0)) {
      throw new Response("Value must be a positive number", { status: 400 });
    }
    return {
      id: optionalUuid(d?.id),
      companyId: optionalUuid(d?.companyId),
      name: text(d?.name, "Name", 200, true) as string,
      stage: text(d?.stage, "Stage", 80),
      valueUsd,
    };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { actions } = await writer();
    const identity = await identityFor("deals", data.id);
    await actions.upsertDeal({ ...identity, ...data });
    return { ok: true };
  });

export const addNote = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    companyId: optionalUuid(d?.companyId),
    title: text(d?.title, "Title", 200),
    content: text(d?.content, "Note", 8000, true) as string,
  }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { actions, actor } = await writer();
    // A note is always new; there is no edit-in-place, so the key is fresh and
    // the actor is recorded as the source rather than a generic "crm".
    await actions.upsertNote({
      source: actor,
      sourceRecordId: crypto.randomUUID(),
      companyId: data.companyId,
      title: data.title,
      content: data.content,
    });
    return { ok: true };
  });

export const setTaskCompleted = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    id: requireUuid(d?.id),
    isCompleted: Boolean(d?.isCompleted),
  }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { actions } = await writer();
    const read = await reader();
    const row = await read.getById<Record<string, unknown>>(
      "tasks",
      data.id,
      "id,source,source_record_id,company_id,content,deadline_at",
    );
    notFound(row);
    // Re-upsert with the same identity so this updates rather than duplicates.
    await actions.upsertTask({
      source: str(row.source) ?? "crm",
      sourceRecordId: str(row.source_record_id) ?? String(row.id),
      companyId: str(row.company_id),
      content: str(row.content) ?? "",
      isCompleted: data.isCompleted,
      deadlineAt: str(row.deadline_at),
    });
    return { ok: true };
  });

export const advanceStage = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    dealId: requireUuid(d?.dealId),
    toStage: text(d?.toStage, "Stage", 80, true) as string,
    // The note is mandatory by design. Advancing a stage crosses a gate, and a
    // stage change with no stated reason is not evidence of anything.
    note: text(d?.note, "Note", 2000, true) as string,
  }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { actions, actor } = await writer();
    await actions.advanceDealStage({ ...data, actor });
    return { ok: true };
  });

/** Stage options for the board and the advance control, straight from the
 *  seeded table so the UI cannot drift from the documented process. */
export const crmStages = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ name: string; sort_order: number; artifact: string | null; gate: string | null }[]> => {
    const read = await reader();
    const rows = await read.listStages<Record<string, unknown>>().catch(() => []);
    return rows.map((r) => ({
      name: str(r.name) ?? "",
      sort_order: num(r.sort_order) ?? 0,
      artifact: str(r.artifact),
      gate: str(r.gate),
    }));
  },
);

/* ── Phase 03: the pipeline board ───────────────────────────────────────── */

export interface PipelineColumn {
  name: string;
  sort_order: number;
  artifact: string | null;
  gate: string | null;
  deals: { id: string; name: string; value_usd: number | null; company: string | null }[];
  total_usd: number;
}

/** Stages and their deals together. Deals whose stage does not match a seeded
 *  stage are grouped under the first column rather than dropped - a deal that
 *  vanishes from the board because of a typo is worse than one in the wrong
 *  place, because nobody goes looking for it. */
export const crmPipeline = createServerFn({ method: "GET" }).handler(
  async (): Promise<PipelineColumn[]> => {
    const read = await reader();
    const [stages, deals, companies] = await Promise.all([
      read.listStages<Record<string, unknown>>(),
      read.listDeals<Record<string, unknown>>(),
      read.listCompanies<Record<string, unknown>>(),
    ]);
    const companyName = new Map(companies.map((c) => [String(c.id), str(c.name)]));
    const known = new Set(stages.map((s) => str(s.name)));

    const columns: PipelineColumn[] = stages.map((s) => ({
      name: str(s.name) ?? "",
      sort_order: num(s.sort_order) ?? 0,
      artifact: str(s.artifact),
      gate: str(s.gate),
      deals: [],
      total_usd: 0,
    }));
    const byName = new Map(columns.map((c) => [c.name, c]));

    for (const d of deals) {
      const stage = str(d.stage);
      const column = (stage && known.has(stage) ? byName.get(stage) : undefined) ?? columns[0];
      if (!column) continue;
      const value = num(d.value_usd);
      column.deals.push({
        id: String(d.id),
        name: str(d.name) ?? "(unnamed)",
        value_usd: value,
        company: d.company_id ? (companyName.get(String(d.company_id)) ?? null) : null,
      });
      column.total_usd += value ?? 0;
    }
    return columns;
  },
);
