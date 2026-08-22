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
    throw new Error(
      "Amount must be a positive number with at most two decimal places",
    );
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
