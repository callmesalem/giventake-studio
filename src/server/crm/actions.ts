/**
 * Server-only CRM write actions for the dashboard.
 *
 * Separate from the read layer on purpose: this is the only module that mutates
 * CRM state from the dashboard, and it does so through security-definer RPCs with
 * the service-role key (server-side only).
 *
 * It now covers every human write the dashboard makes: companies, contacts,
 * deals, notes, tasks, stage advances, referrals, reviews, campaigns, invoices,
 * clients and assignment. None of it sends, deploys, or executes anything on
 * its own — the approval queue and the send gates remain the only paths toward
 * a recipient, and both end at a human.
 */

import { advanceBlockedByUnsignedSow, canAssign, isCloseStage } from "@/lib/crm-guards";

/** Re-exported so the stage-4 rule has one name wherever it is read from.
 *  It is DEFINED in crm-guards.ts rather than here because this module imports
 *  through the "@/" alias and so cannot be loaded by `node
 *  --experimental-strip-types` — a gate whose predicate no test can import is a
 *  comment with extra steps. tests/documents-gate.test.mjs exercises the same
 *  function objects this file calls below. */
export { advanceBlockedByUnsignedSow, isCloseStage, CLOSE_STAGE_NAME } from "@/lib/crm-guards";

type Fetch = typeof globalThis.fetch;

export interface CrmActionsOptions {
  url: string;
  serviceRoleKey: string;
  fetch?: Fetch;
}

export class CrmActions {
  readonly #url: string;
  readonly #key: string;
  readonly #fetch: Fetch;

  constructor(options: CrmActionsOptions) {
    if (!options.url || !options.serviceRoleKey) {
      throw new Error("CrmActions requires url and serviceRoleKey");
    }
    this.#url = options.url.replace(/\/$/, "");
    this.#key = options.serviceRoleKey;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  async #rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
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
      // Surface the RPC's own message (e.g. "approval already decided") so the
      // dashboard can show a useful reason.
      let message = `CRM action ${name} failed: ${response.status}`;
      try {
        const err = (await response.json()) as { message?: string; hint?: string };
        if (err.message) message = err.message;
      } catch {
        // keep default
      }
      throw new Error(message);
    }
    return (await response.json()) as T;
  }

  /** Record a human decision on a pending approval. Marks the decision only. */
  decideApproval(
    id: string,
    decision: "approved" | "rejected",
    decidedBy: string,
    reason: string,
  ): Promise<boolean> {
    return this.#rpc<boolean>("approval_decide", {
      p_id: id,
      p_decision: decision,
      p_decided_by: decidedBy,
      p_reason: reason,
    });
  }

  /* ── Phase 02: human writes ────────────────────────────────────────────────
   *
   * Every one of these goes through the same *_upsert RPCs the agents use. No
   * new data path, so the audit trail, validation and RLS that already guard
   * agent writes guard these identically.
   *
   * Identity note: the upserts key on (source, source_record_id). Editing a
   * record Piper created must therefore pass PIPER'S keys back, not the
   * editor's - otherwise the upsert inserts a second row instead of updating
   * the first. The caller resolves the existing keys and hands them in, which
   * also means provenance survives an edit: a company Piper sourced still says
   * so after a human corrects its address.
   */

  upsertCompany(input: {
    source: string;
    sourceRecordId: string;
    name: string;
    domain?: string | null;
    description?: string | null;
    employeeRange?: string | null;
    location?: string | null;
  }): Promise<unknown> {
    return this.#rpc<unknown>("company_upsert", {
      p_source: input.source,
      p_source_record_id: input.sourceRecordId,
      p_name: input.name,
      p_domain: input.domain ?? null,
      p_description: input.description ?? null,
      p_categories: null,
      p_employee_range: input.employeeRange ?? null,
      p_location: input.location ?? null,
      p_socials: null,
      p_metadata: null,
    });
  }

  upsertContact(input: {
    source: string;
    sourceRecordId: string;
    companyId?: string | null;
    name: string;
    email?: string | null;
    phone?: string | null;
    jobTitle?: string | null;
  }): Promise<unknown> {
    return this.#rpc<unknown>("contact_upsert", {
      p_source: input.source,
      p_source_record_id: input.sourceRecordId,
      p_company_id: input.companyId ?? null,
      p_name: input.name,
      p_email: input.email ?? null,
      p_phone: input.phone ?? null,
      p_job_title: input.jobTitle ?? null,
      p_socials: null,
      p_metadata: null,
    });
  }

  upsertDeal(input: {
    source: string;
    sourceRecordId: string;
    companyId?: string | null;
    name: string;
    stage?: string | null;
    valueUsd?: number | null;
  }): Promise<unknown> {
    return this.#rpc<unknown>("deal_upsert", {
      p_source: input.source,
      p_source_record_id: input.sourceRecordId,
      p_company_id: input.companyId ?? null,
      p_name: input.name,
      p_stage: input.stage ?? null,
      p_value_usd: input.valueUsd ?? null,
      p_metadata: null,
    });
  }

  upsertNote(input: {
    source: string;
    sourceRecordId: string;
    companyId?: string | null;
    leadId?: string | null;
    title?: string | null;
    content: string;
  }): Promise<unknown> {
    return this.#rpc<unknown>("note_upsert", {
      p_source: input.source,
      p_source_record_id: input.sourceRecordId,
      p_company_id: input.companyId ?? null,
      p_title: input.title ?? null,
      p_content: input.content,
      p_metadata: null,
      p_lead_id: input.leadId ?? null,
    });
  }

  upsertTask(input: {
    source: string;
    sourceRecordId: string;
    companyId?: string | null;
    content: string;
    isCompleted?: boolean;
    deadlineAt?: string | null;
  }): Promise<unknown> {
    return this.#rpc<unknown>("task_upsert", {
      p_source: input.source,
      p_source_record_id: input.sourceRecordId,
      p_company_id: input.companyId ?? null,
      p_content: input.content,
      p_is_completed: input.isCompleted ?? false,
      p_deadline_at: input.deadlineAt ?? null,
      p_metadata: null,
    });
  }

  /** Advance a deal. The RPC stamps the actor and requires a note; it does NOT
   *  assert the stage gate was satisfied, because for eleven of the twelve
   *  stages that is a human judgement and a function cannot witness it.
   *
   *  Stage 4 ("Close") is the one exception, enforced here. Its gate is "Signed
   *  and paid before any code", and a signature — unlike "Problem understood,
   *  quantified" — is a fact with a record: document_signatures. So before the
   *  advance is sent, deal_has_signed_sow is asked, and anything other than a
   *  true refuses the advance. Only the SIGNATURE is asserted; payment is not,
   *  because invoices.paid_at depends on Stripe reconciliation and a webhook
   *  hiccup must not block work that is genuinely signed. See
   *  advanceBlockedByUnsignedSow in crm-guards.ts for the full reasoning.
   *
   *  A failed or unparseable RPC throws out of #rpc rather than resolving, so
   *  a check that cannot be made refuses the advance instead of waving it
   *  through — the same fail-closed posture as DocumentStore.dealHasSignedSow. */
  async advanceDealStage(input: {
    dealId: string;
    toStage: string;
    note: string;
    actor: string;
  }): Promise<unknown> {
    // Asked first so the RPC is not paid for on the eleven advances that do not
    // need it, and so an unrelated advance cannot be refused by a document
    // lookup that failed.
    if (isCloseStage(input.toStage)) {
      const signed = await this.#rpc<boolean | null>("deal_has_signed_sow", {
        p_deal_id: input.dealId,
      });
      if (advanceBlockedByUnsignedSow(input.toStage, signed)) {
        throw new Error(
          "Stage 4 (Close) requires a signed SOW. Generate the SOW and send it for signature first.",
        );
      }
    }
    return this.#rpc<unknown>("deal_advance_stage", {
      p_deal_id: input.dealId,
      p_to_stage: input.toStage,
      p_note: input.note,
      p_actor: input.actor,
    });
  }

  /* ── Phase 06: referrals ──────────────────────────────────────────────── */

  upsertReferralPartner(input: {
    id?: string | null;
    name: string;
    kind?: string | null;
    contactEmail?: string | null;
    notes?: string | null;
  }): Promise<unknown> {
    return this.#rpc<unknown>("referral_partner_upsert", {
      p_id: input.id ?? null,
      p_name: input.name,
      p_kind: input.kind ?? null,
      p_contact_email: input.contactEmail ?? null,
      p_notes: input.notes ?? null,
    });
  }

  recordReferral(input: {
    partnerId: string;
    leadId?: string | null;
    companyName: string;
  }): Promise<unknown> {
    return this.#rpc<unknown>("referral_record", {
      p_partner_id: input.partnerId,
      p_lead_id: input.leadId ?? null,
      p_company_name: input.companyName,
    });
  }

  setReferralStatus(id: string, status: string): Promise<unknown> {
    return this.#rpc<unknown>("referral_set_status", { p_id: id, p_status: status });
  }

  /* ── Phase 07: assignment ─────────────────────────────────────────────── */

  /** The *_upsert RPCs do not carry ownership, so this writes through PostgREST
   *  directly. Both table and column are checked against the allowlist first,
   *  and the id is a validated UUID by the time it arrives. */
  async assign(table: string, column: string, id: string, userId: string | null): Promise<void> {
    // canAssign lives in crm-guards and is tested there. The previous inline
    // lookup indexed the record directly, so a table named "constructor" would
    // have returned a function and thrown on .includes rather than being
    // refused cleanly.
    if (!canAssign(table, column)) {
      throw new Response("That record cannot be assigned", { status: 400 });
    }
    const response = await this.#fetch(`${this.#url}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: this.#key,
        Authorization: `Bearer ${this.#key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ [column]: userId }),
    });
    if (!response.ok) {
      throw new Error(`assign ${table}.${column} failed: ${response.status}`);
    }
  }

  /** Lead intake. origin distinguishes a hand-typed lead from a website
   *  submission so the audit trail is not a polite fiction. */
  captureLead(input: {
    email: string;
    name: string;
    company?: string | null;
    description?: string | null;
    source?: string | null;
    origin: "manual_entry" | "referral_intake";
  }): Promise<unknown> {
    return this.#rpc<unknown>("capture_website_lead", {
      p_payload: {
        email: input.email,
        name: input.name,
        company: input.company ?? undefined,
        description: input.description ?? undefined,
        source: input.source ?? undefined,
        origin: input.origin,
      },
    });
  }

  /* ── Phase 12: lead conversion ────────────────────────────────────────── */

  /** deal_upsert carries no lead_id, so the attribution link is set here.
   *  A narrow method rather than a general patch: this is the only column it
   *  can ever write, which is a smaller surface than a table/column allowlist
   *  and needs no validation to stay correct. */
  async linkDealToLead(dealId: string, leadId: string): Promise<void> {
    const response = await this.#fetch(`${this.#url}/rest/v1/deals?id=eq.${dealId}`, {
      method: "PATCH",
      headers: {
        apikey: this.#key,
        Authorization: `Bearer ${this.#key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ lead_id: leadId }),
    });
    if (!response.ok) throw new Error(`link deal to lead failed: ${response.status}`);
  }

  async setLeadStatus(leadId: string, status: string): Promise<void> {
    const response = await this.#fetch(`${this.#url}/rest/v1/leads?id=eq.${leadId}`, {
      method: "PATCH",
      headers: {
        apikey: this.#key,
        Authorization: `Bearer ${this.#key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error(`set lead status failed: ${response.status}`);
  }

  /* ── Phase 13: deal becomes client ────────────────────────────────────── */

  /** There is no client_upsert RPC, so this writes through PostgREST with an
   *  explicit column list. Only these five columns are ever sent - synthetic,
   *  created_at and id keep their defaults, and nothing here can set them. */
  async createClient(input: {
    name: string;
    leadId: string | null;
    dealId: string;
    aiProcessingAllowed: boolean;
    ownerId: string | null;
  }): Promise<string> {
    const response = await this.#fetch(`${this.#url}/rest/v1/clients`, {
      method: "POST",
      headers: {
        apikey: this.#key,
        Authorization: `Bearer ${this.#key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        name: input.name,
        lead_id: input.leadId,
        deal_id: input.dealId,
        ai_processing_allowed: input.aiProcessingAllowed,
        owner_id: input.ownerId,
      }),
    });
    if (!response.ok) throw new Error(`create client failed: ${response.status}`);
    const rows = (await response.json()) as { id: string }[];
    return rows[0]?.id ?? "";
  }

  async createProject(clientId: string, name: string): Promise<void> {
    const response = await this.#fetch(`${this.#url}/rest/v1/projects`, {
      method: "POST",
      headers: {
        apikey: this.#key,
        Authorization: `Bearer ${this.#key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ client_id: clientId, name }),
    });
    if (!response.ok) throw new Error(`create project failed: ${response.status}`);
  }

  /* ── Phase 14: reviews, campaigns, invoices ───────────────────────────── */

  upsertReview(input: {
    id?: string | null;
    source: string;
    authorName: string;
    subject?: string | null;
    rating?: number | null;
    quote?: string | null;
    permissionObtained: boolean;
  }): Promise<unknown> {
    return this.#rpc<unknown>("review_upsert", {
      p_id: input.id ?? null,
      p_source: input.source,
      p_author_name: input.authorName,
      p_subject: input.subject ?? null,
      p_rating: input.rating ?? null,
      p_quote: input.quote ?? null,
      p_permission_obtained: input.permissionObtained,
    });
  }

  /** The RPC refuses to publish a review with no permission on file. That check
   *  lives in the database rather than here on purpose - a UI guard can be
   *  bypassed, a function cannot. */
  setReviewStatus(id: string, status: string): Promise<unknown> {
    return this.#rpc<unknown>("review_set_status", { p_id: id, p_status: status });
  }

  upsertCampaign(input: {
    id?: string | null;
    name: string;
    goal?: string | null;
    channel?: string | null;
    status?: string | null;
    owner?: string | null;
  }): Promise<unknown> {
    return this.#rpc<unknown>("campaign_upsert", {
      p_id: input.id ?? null,
      p_name: input.name,
      p_goal: input.goal ?? null,
      p_channel: input.channel ?? null,
      p_status: input.status ?? null,
      p_audience: null,
      p_owner: input.owner ?? null,
    });
  }

  /** No invoice RPC exists, so an explicit column list again. Amounts are held
   *  in CENTS - the column is amount_cents and money in floating point is how
   *  totals drift by a penny and nobody can say why. */
  async createInvoice(input: {
    projectId: string;
    amountCents: number;
    currency: string;
    status: string;
    dueAt: string | null;
  }): Promise<void> {
    const response = await this.#fetch(`${this.#url}/rest/v1/invoices`, {
      method: "POST",
      headers: {
        apikey: this.#key,
        Authorization: `Bearer ${this.#key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        project_id: input.projectId,
        amount_cents: input.amountCents,
        currency: input.currency,
        status: input.status,
        due_at: input.dueAt,
      }),
    });
    if (!response.ok) throw new Error(`create invoice failed: ${response.status}`);
  }
}
