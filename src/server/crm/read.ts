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

export interface CrmReadOptions {
  url: string;
  serviceRoleKey: string;
  fetch?: Fetch;
}

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

  constructor(options: CrmReadOptions) {
    if (!options.url || !options.serviceRoleKey) {
      throw new Error("CrmRead requires url and serviceRoleKey");
    }
    this.#url = options.url.replace(/\/$/, "");
    this.#key = options.serviceRoleKey;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
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
    return (await response.json()) as T[];
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
  listLeads<T = Record<string, unknown>>(): Promise<T[]> {
    return this.#rpc<T[]>("leads_list", { p_limit: 200 });
  }

  /** Everything the dashboard home needs, in one round of parallel reads. */
  async getOverview(): Promise<CrmOverview> {
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
