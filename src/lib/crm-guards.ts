/**
 * Pure guards shared by the CRM server functions.
 *
 * These were inline in crm-data.ts, which imports server-only modules and
 * therefore cannot be loaded by a test. That is a bad place for the logic that
 * decides what reaches a database and what reaches a recipient — the sanitiser
 * that closes a query-injection surface, the UUID check that guards PostgREST
 * filters, and the two gates that stand between a draft and a person's inbox.
 *
 * Nothing here touches the network, the request, or the environment, so all of
 * it is testable and all of it is tested.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID.test(value.trim());
}

/**
 * Reduce a search term to characters PostgREST cannot read as syntax.
 *
 * Commas, parentheses, dots and equals are structural inside `or=(...)`, so an
 * unsanitised term is not merely a bad search — it is a query-injection
 * surface. Letters, digits, spaces, @ and hyphen are enough to find a company
 * or a person.
 *
 * Whitespace is collapsed afterwards because stripping adjacent metacharacters
 * leaves runs of spaces, and an ilike pattern containing "  " matches nothing.
 */
export function searchTerm(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  return raw
    .replace(/[^\p{L}\p{N}\s@-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Charter §5 disclosure footer, verbatim. Settled by Salem on 2026-08-21: it
 * stays. Compared as exact bytes — an em dash is not a hyphen and a paraphrase
 * is not the footer.
 */
export const DISCLOSURE_FOOTER = [
  "—",
  "This message was sent automatically by GivenTake Devs.",
  "Reply and a person will read it.",
].join("\n");

export function hasDisclosureFooter(body: unknown): boolean {
  return typeof body === "string" && body.includes(DISCLOSURE_FOOTER);
}

/**
 * A US postal address, loosely: a street number and line, then a state and ZIP.
 *
 * Deliberately permissive. The job is to catch ABSENCE — which is the current
 * reality while the entity is unformed — not to validate formatting. A phone
 * number must not satisfy it.
 */
const POSTAL = /\d+\s+\S+.*\b[A-Z]{2}\s+\d{5}(-\d{4})?\b/;

export function hasPostalAddress(body: unknown): boolean {
  return typeof body === "string" && POSTAL.test(body);
}

/**
 * Dollars in, cents out — without ever multiplying a float.
 *
 * The obvious `Math.round(amount * 100)` is wrong and the failure is invisible:
 * 1.005 * 100 is 100.49999999999999, so a $1.005 line becomes 100 cents. Adding
 * an epsilon fixes that case and breaks 1.115, whose stored double is really
 * 1.1149999…, so the two methods disagree about the same input. There is no
 * correct float answer, only differently-wrong ones.
 *
 * So the decimal string is parsed directly. Exact by construction, and inputs
 * with more precision than a cent are REJECTED rather than silently rounded —
 * you cannot invoice a third of a penny, and quietly deciding which way it goes
 * is how a total stops reconciling.
 */
export function dollarsToCents(value: unknown): number {
  const raw = typeof value === "string" ? value.trim() : String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error("Amount must be a positive number with at most two decimal places");
  }
  const [whole, frac = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (cents <= 0) {
    throw new Error("Amount must be a positive number with at most two decimal places");
  }
  return cents;
}

/** A record that can belong to someone. */
export interface Ownable {
  owner_id?: string | null;
  assigned_to?: string | null;
}

/**
 * Whether a row survives the list filter.
 *
 * "Mine" matches owner OR assignee, so work handed to you appears without
 * transferring ownership of the relationship. With no signed-in user the mine
 * filter cannot mean anything and is ignored rather than hiding everything.
 */
export function passesListFilter<T extends Ownable>(
  row: T,
  text: string,
  options: { query: string; mineOnly: boolean; currentUserId: string | null },
): boolean {
  if (options.mineOnly && options.currentUserId) {
    const mine =
      row.owner_id === options.currentUserId || row.assigned_to === options.currentUserId;
    if (!mine) return false;
  }
  const needle = options.query.trim().toLowerCase();
  if (!needle) return true;
  return text.toLowerCase().includes(needle);
}

/* ── Assignment allowlist ───────────────────────────────────────────────────
 *
 * Ownership cannot go through the *_upsert RPCs, so it is written to PostgREST
 * directly. Without this list, a table name arriving from anywhere upstream
 * would be an arbitrary-table write primitive holding the service role key.
 *
 * It lives here, beside the tests, rather than inside the class that uses it -
 * an allowlist nobody can test is a comment with extra steps.
 */
export const ASSIGNABLE: Record<string, readonly string[]> = {
  leads: ["owner_id", "assigned_to"],
  deals: ["owner_id", "assigned_to"],
  tasks: ["owner_id", "assigned_to"],
  companies: ["owner_id"],
  contacts: ["owner_id"],
  notes: ["owner_id"],
  clients: ["owner_id"],
  projects: ["owner_id"],
  invoices: ["owner_id"],
  referrals: ["owner_id"],
};

/** Whether this exact table and column pair may be assigned. */
export function canAssign(table: unknown, column: unknown): boolean {
  if (typeof table !== "string" || typeof column !== "string") return false;
  const columns = Object.prototype.hasOwnProperty.call(ASSIGNABLE, table)
    ? ASSIGNABLE[table]
    : undefined;
  return Boolean(columns?.includes(column));
}

/* ── Send gates ─────────────────────────────────────────────────────────────
 *
 * The five checks between a draft and a recipient, assembled from facts the
 * caller has already gathered. Pure, so the decision itself is testable without
 * a database or a mail provider.
 */

export interface GateFacts {
  outboundEnabled: boolean | undefined;
  outboundReason?: string | undefined;
  suppressed: boolean;
  approvedRecipient: boolean;
  sop: string;
  hasFooter: boolean;
  hasPostal: boolean;
}

export interface Gate {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
  blocking: boolean;
}

export function buildGates(facts: GateFacts): Gate[] {
  return [
    {
      id: "kill-switch",
      label: "Outbound enabled",
      // Anything other than an explicit true is off. An undefined control -
      // unreadable, absent, malformed - must never read as permission.
      pass: facts.outboundEnabled === true,
      blocking: true,
      detail:
        facts.outboundEnabled === true
          ? "operator_system_control.outbound_enabled is on."
          : `Off${facts.outboundReason ? ` — "${facts.outboundReason}"` : ""}. Nothing can send while this is false.`,
    },
    {
      id: "suppression",
      label: "Not suppressed",
      pass: facts.suppressed === false,
      blocking: true,
      detail: facts.suppressed
        ? "This address is on do_not_contact. A hit is final."
        : "No do_not_contact entry.",
    },
    {
      id: "approved-recipient",
      label: "On the approved list",
      pass: facts.approvedRecipient === true,
      blocking: true,
      detail: facts.approvedRecipient
        ? `Approved for SOP "${facts.sop}".`
        : `Not on approved_recipients for "${facts.sop}". Charter §3.8: absence is a no, and a clean suppression check is not a substitute.`,
    },
    {
      id: "footer",
      label: "Disclosure footer present",
      pass: facts.hasFooter,
      blocking: true,
      detail: facts.hasFooter
        ? "Present verbatim."
        : "Missing or altered. Charter §5 requires it exactly, and Salem confirmed on 2026-08-21 that it stays.",
    },
    {
      id: "postal",
      label: "Postal address (CAN-SPAM)",
      pass: facts.hasPostal,
      blocking: true,
      detail: facts.hasPostal
        ? "A postal address appears in the body."
        : "No postal address found. CAN-SPAM requires one for the sending entity, and the entity is unformed — the MSA still reads [GivenTake Devs LLC] with Form 610 unfiled. This is the gate no code can clear.",
    },
  ];
}

export function isSendable(gates: Gate[]): boolean {
  return gates.every((g) => g.pass || !g.blocking);
}

/* ── Conversion identity ────────────────────────────────────────────────────
 *
 * Converting a lead creates a company, a contact and a deal. All three key on
 * this value, so a second click updates the same three rows instead of quietly
 * creating a parallel set nobody notices until the pipeline total is wrong.
 */
export function conversionKey(leadId: string): string {
  return `lead:${leadId}`;
}

/** Origins capture_website_lead accepts. Closed, because a free-text provenance
 *  field stops meaning anything the first time somebody invents a value. */
export const LEAD_ORIGINS = ["website_contact_form", "manual_entry", "referral_intake"] as const;

export function isLeadOrigin(value: unknown): boolean {
  return (LEAD_ORIGINS as readonly string[]).includes(String(value));
}

/* ── Stage 4's gate ─────────────────────────────────────────────────────────
 *
 * pipeline_stages numbers this stage 4 and names it "Close", but the number
 * never travels. deals.stage stores stage NAMES, crmStages feeds the UI those
 * names, and crm-data.ts validates toStage as an arbitrary string, so the value
 * that reaches the gate is "Close". A gate keyed on 4 - or on "4" - would exist,
 * pass its tests, render in the UI, and let every real deal through unsigned.
 *
 * The name is a constant here rather than resolved from pipeline_stages at call
 * time, and that is the trade being made deliberately. A lookup would follow a
 * rename, but it would need the network, which would make this predicate
 * impure, untestable without a database, and - worse - failable: a gate whose
 * lookup errors has to decide whether to open, and there is no good answer. A
 * literal cannot fail to load. If the stage is ever renamed, this constant and
 * the test asserting it both have to change, which is the point: renaming the
 * stage that requires a signature should be a visible act, not a silent one.
 */
export const CLOSE_STAGE_NAME = "Close";

/**
 * Whether a requested stage IS stage 4, by name.
 *
 * Trimmed and case-insensitive, because the value is a free-text field an
 * operator can type, but otherwise EXACT: "Closed won" is a different stage and
 * a prefix or substring match would gate it too, on evidence this feature has
 * no claim over. Anything that is not a string is not Close — including the
 * number 4 and the string "4", neither of which is ever what deals.stage holds.
 *
 * Separate from the gate below so the caller can ask "does this advance need a
 * signature at all?" without pretending to already know the answer, and so the
 * two questions cannot drift apart: the gate is defined in terms of this.
 */
export function isCloseStage(toStage: unknown): boolean {
  if (typeof toStage !== "string") return false;
  return toStage.trim().toLowerCase() === CLOSE_STAGE_NAME.toLowerCase();
}

/**
 * Whether an advance into stage 4 must be refused for want of a signed SOW.
 *
 * This is a DELIBERATE EXCEPTION to the rule stated on advanceDealStage: the
 * RPC does not assert stage gates, because gates like "Problem understood,
 * quantified" or "Client saw it working each week" are human judgements and a
 * function cannot witness them. Stage 4 differs in kind. Its gate is "Signed
 * and paid before any code", and a signature is not a judgement - it is a fact
 * with a record. document_signatures IS that record, so this one gate can be
 * asserted honestly, and a gate that can be asserted honestly should be.
 *
 * PAYMENT IS DELIBERATELY NOT PART OF THIS. The gate's wording says "signed and
 * paid", but invoices.paid_at depends on Stripe reconciliation: a webhook that
 * arrives late, retries, or drops would block work that is genuinely signed and
 * genuinely paid, and an operator staring at a gate the database is simply
 * wrong about learns to route around gates. Payment is surfaced in the UI as an
 * unmet condition a human can read and act on, which is the right home for a
 * fact this system does not own end to end.
 *
 * Pure by construction: it takes the two facts and returns a decision, so the
 * rule can be asserted without a database. Stage matching is isCloseStage
 * above. Anything that is not exactly `true` is not a signature — an absent,
 * null or unreadable answer must never read as one, the same posture
 * DocumentStore.dealHasSignedSow takes when its own call fails.
 */
export function advanceBlockedByUnsignedSow(toStage: unknown, hasSignedSow: unknown): boolean {
  if (!isCloseStage(toStage)) return false;
  return hasSignedSow !== true;
}
