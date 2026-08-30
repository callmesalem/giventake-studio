/**
 * Server-only CRM read layer for the dashboard.
 *
 * The CRM schema is locked (RLS on, no grants to anon/authenticated, access only
 * via security-definer RPCs granted to service_role). So the dashboard reads
 * happen HERE, server-side, with the service-role key, never in the browser.
 * Login gates who reaches these functions; the key never leaves the server.
 *
 * Read-only: this module only calls snapshot / list RPCs. It never writes and
 * never sends.
 */

type Fetch = typeof globalThis.fetch;

export interface CrmActor {
  /** The signed-in user's id, or null for a system/no-actor context. */
  id: string | null;
  /** Admins see everything; members are scoped to what they own or are assigned. */
  isAdmin: boolean;
}

export interface CrmReadOptions {
  url: string;
  serviceRoleKey: string;
  fetch?: Fetch;
  /** Who is reading. Omitted => full access (admin), so existing server callers
   *  and tests that construct CrmRead without an actor are unaffected. */
  actor?: CrmActor;
}

/** Per-table visibility for a MEMBER (non-admin). Admins bypass all of this.
 *  - "shared": every member sees the whole table (reference/directory data).
 *  - "owned": a member sees only rows they own or are assigned (plus, for
 *    leads, the unassigned inbound pool they may claim).
 *  - "admin_only": members see nothing (financial / governance data).
 *  Any table not listed defaults to "owned" (fail closed). */
type MemberVisibility = "shared" | "owned" | "admin_only";
const MEMBER_TABLE_POLICY: Record<string, MemberVisibility> = {
  companies: "shared",
  contacts: "shared",
  pipeline_stages: "shared",
  leads: "owned",
  deals: "owned",
  tasks: "owned",
  notes: "owned",
  clients: "admin_only",
  invoices: "admin_only",
  projects: "admin_only",
  referrals: "admin_only",
  approval_queue: "admin_only",
};

export interface CrmOverview {
  prospecting: { companies: number; contacts: number; deals: number };
  campaigns: { campaigns: unknown[]; enrollmentsByStatus: Record<string, number> };
  newsletter: { subscribersByStatus: Record<string, number>; issues: unknown[] };
  reputation: { reviewsByStatus: Record<string, number>; requestsByStatus: Record<string, number> };
  referral: { partners: unknown[]; referralsByStatus: Record<string, number> };
  activity: { notes: number; tasks: number; openTasks: number };
  pendingApprovals: number;
}

export class CrmRead {
  readonly #url: string;
  readonly #key: string;
  readonly #fetch: Fetch;
  readonly #actor: CrmActor;

  constructor(options: CrmReadOptions) {
    if (!options.url || !options.serviceRoleKey) {
      throw new Error("CrmRead requires url and serviceRoleKey");
    }
    this.#url = options.url.replace(/\/$/, "");
    this.#key = options.serviceRoleKey;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    // Default to admin (full access) when no actor is supplied, so existing
    // server callers and tests are unaffected. crm-data.ts passes the real actor.
    this.#actor = options.actor ?? { id: null, isAdmin: true };
  }

  /** Apply member row-visibility. Admins get everything; members are filtered
   *  to their owned/assigned rows per MEMBER_TABLE_POLICY. Filtering happens
   *  here, server-side, after the service-role read: PostgREST cannot see the
   *  app-level user, so this app layer is the correct place to scope. */
  #scope<T>(table: string, rows: T[]): T[] {
    if (this.#actor.isAdmin) return rows;
    const visibility = MEMBER_TABLE_POLICY[table] ?? "owned";
    if (visibility === "shared") return rows;
    if (visibility === "admin_only") return [];
    const me = this.#actor.id;
    if (!me) return [];
    return rows.filter((row) => {
      const rec = row as Record<string, unknown>;
      if (rec.owner_id === me || rec.assigned_to === me) return true;
      // Unassigned inbound leads form a claimable pool visible to members.
      if (table === "leads" && rec.owner_id === null && rec.assigned_to === null) return true;
      return false;
    });
  }

  async #rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
    const response = await this.#fetch(`${this.#url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: this.#key,
        Authorization: `Bearer ${this.#key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`CRM rpc ${name} failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  /**
   * Read rows from a CRM table via PostgREST (service-role, server-side only).
   * Works for the prospecting/campaign/activity/approval tables, which allow
   * direct service-role reads. `leads` is locked to RPC-only and is read through
   * a dedicated function instead.
   */
  async #select<T>(
    table: string,
    query = "select=*&order=created_at.desc&limit=200",
  ): Promise<T[]> {
    const response = await this.#fetch(`${this.#url}/rest/v1/${table}?${query}`, {
      headers: { apikey: this.#key, Authorization: `Bearer ${this.#key}` },
    });
    if (!response.ok) throw new Error(`CRM read ${table} failed: ${response.status}`);
    const rows = (await response.json()) as T[];
    return this.#scope(table, rows);
  }

  listCompanies<T = Record<string, unknown>>(): Promise<T[]> {
    return this.#select<T>(
      "companies",
      "select=id,name,domain,description,employee_range,location,source,owner_id&order=name.asc&limit=500",
    );
  }
  listDeals<T = Record<string, unknown>>(): Promise<T[]> {
    return this.#select<T>(
      "deals",
      "select=id,name,stage,value_usd,company_id,source,owner_id,assigned_to&order=created_at.desc&limit=500",
    );
  }
  listContacts<T = Record<string, unknown>>(): Promise<T[]> {
    return this.#select<T>(
      "contacts",
      "select=id,name,email,phone,job_title,company_id,owner_id&order=name.asc&limit=500",
    );
  }
  listPendingApprovals<T = Record<string, unknown>>(): Promise<T[]> {
    return this.#select<T>(
      "approval_queue",
      "select=id,agent_name,action_type,summary,risk_level,requested_at&status=eq.pending&order=requested_at.desc&limit=200",
    );
  }

  /**
   * `leads` is RPC-only (its direct service-role grant was revoked by the
   * security-hardening migration), so it is read through the leads_list
   * security-definer function, which returns real (non-synthetic) leads.
   */
  async listLeads<T = Record<string, unknown>>(): Promise<T[]> {
    // leads is RPC-only; the RPC returns owner_id/assigned_to (see the
    // leads_list owner-fields migration) so member visibility applies here too.
    const rows = await this.#rpc<T[]>("leads_list", { p_limit: 200 });
    return this.#scope("leads", Array.isArray(rows) ? rows : []);
  }

  /** Everything the dashboard home needs, in one round of parallel reads. */
  async getOverview(): Promise<CrmOverview> {
    if (!this.#actor.isAdmin) {
      // Members do not see company-wide aggregates. A member-scoped home (their
      // own counts) is a fast follow (H1b); until then, no aggregates leak.
      return {
        prospecting: { companies: 0, contacts: 0, deals: 0 },
        campaigns: { campaigns: [], enrollmentsByStatus: {} },
        newsletter: { subscribersByStatus: {}, issues: [] },
        reputation: { reviewsByStatus: {}, requestsByStatus: {} },
        referral: { partners: [], referralsByStatus: {} },
        activity: { notes: 0, tasks: 0, openTasks: 0 },
        pendingApprovals: 0,
      };
    }
    const [prospecting, campaigns, newsletter, reputation, referral, activity, pending] =
      await Promise.all([
        this.#rpc<CrmOverview["prospecting"]>("prospecting_snapshot"),
        this.#rpc<CrmOverview["campaigns"]>("campaign_snapshot"),
        this.#rpc<CrmOverview["newsletter"]>("newsletter_snapshot"),
        this.#rpc<CrmOverview["reputation"]>("reputation_snapshot"),
        this.#rpc<CrmOverview["referral"]>("referral_snapshot"),
        this.#rpc<CrmOverview["activity"]>("activity_snapshot"),
        this.#rpc<unknown[]>("approval_queue_list", { p_status: "pending" }),
      ]);
    return {
      prospecting,
      campaigns,
      newsletter,
      reputation,
      referral,
      activity,
      pendingApprovals: Array.isArray(pending) ? pending.length : 0,
    };
  }

  // ── Phase 01: single records and their history ────────────────────────────
  //
  // PostgREST filters are built from an id we validate as a UUID before it gets
  // here (see crm-data.ts). Anything that reaches this layer is already shaped.

  /** One row by id, or null. Uses limit=1 rather than .single() so a missing
   *  record is an empty result to handle, not a thrown error to catch. */
  async getById<T = Record<string, unknown>>(
    table: string,
    id: string,
    select = "*",
  ): Promise<T | null> {
    const rows = await this.#select<T>(table, `select=${select}&id=eq.${id}&limit=1`);
    return rows[0] ?? null;
  }

  /** Rows of `table` whose `column` matches `value`. The building block for
   *  every "what is attached to this record" query. */
  relatedBy<T = Record<string, unknown>>(
    table: string,
    column: string,
    value: string,
    select = "*",
    order = "created_at.desc",
    limit = 200,
  ): Promise<T[]> {
    return this.#select<T>(
      table,
      `select=${select}&${column}=eq.${value}&order=${order}&limit=${limit}`,
    );
  }

  /** Whole small table, ordered. relatedBy needs a filter column; these tables
   *  are read in full. */
  relatedByAll<T = Record<string, unknown>>(
    table: string,
    select = "*",
    order = "created_at.desc",
    limit = 300,
  ): Promise<T[]> {
    return this.#select<T>(table, `select=${select}&order=${order}&limit=${limit}`);
  }

  /** Charter §10 kill switch. */
  systemControl<T = unknown>(): Promise<T> {
    return this.#rpc<T>("operator_get_system_control");
  }

  /** do_not_contact. A hit is final. */
  isSuppressed(address: string): Promise<boolean> {
    return this.#rpc<boolean>("operator_is_suppressed", { p_address: address });
  }

  /** Charter §3.8 positive allowlist, per SOP. A clean suppression check is not
   *  a substitute: absence from this list is a no. */
  isApprovedRecipient(address: string, sop: string): Promise<boolean> {
    return this.#rpc<boolean>("is_approved_recipient", { p_address: address, p_sop: sop });
  }

  /** Which channel produced paying clients. Built this morning and displayed
   *  nowhere until now. */
  attribution<T = unknown>(): Promise<T> {
    return this.#rpc<T>("attribution_snapshot");
  }

  /** Case-insensitive contains-match across the given columns.
   *
   *  The term is sanitised by the caller before it gets here. PostgREST parses
   *  commas and parentheses as syntax inside or=(), so an unsanitised term is
   *  not merely a bad search, it is a query-injection surface. */
  searchIn<T = Record<string, unknown>>(
    table: string,
    columns: string[],
    term: string,
    select: string,
    limit = 25,
  ): Promise<T[]> {
    const or = columns.map((c) => `${c}.ilike.*${term}*`).join(",");
    return this.#select<T>(table, `select=${select}&or=(${or})&limit=${limit}`);
  }

  /** The 12 seeded stages, in process order. */
  listStages<T = Record<string, unknown>>(): Promise<T[]> {
    return this.#select<T>(
      "pipeline_stages",
      "select=name,sort_order,artifact,gate&order=sort_order.asc&limit=50",
    );
  }

  listTasks<T = Record<string, unknown>>(): Promise<T[]> {
    return this.#select<T>(
      "tasks",
      "select=id,content,is_completed,deadline_at,source,company_id,owner_id,assigned_to,created_at&order=created_at.desc&limit=500",
    );
  }
}
