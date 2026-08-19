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
