/**
 * Merge-fill for the [BRACKETED] convention used across docs/contracts and
 * docs/templates. Pure: no I/O, no database, no clock.
 *
 * The rule is an ALLOWLIST, deliberately. The previous version matched only
 * SHOUTED placeholders — /\[([A-Z][A-Z0-9 _-]*)\]/ — on the theory that
 * anything else was prose. It was not. [NAME, TITLE, EMAIL], [50]%,
 * [fixed fee / monthly retainer] and every [e.g. ...] example row in
 * sow-template.md are genuine blanks, and all of them were invisible to it.
 *
 * So: ANY bracketed run is a merge field unless it is one of three forms that
 * were each verified to occur in the real documents. A client reading a
 * contract cannot tell a leftover blank from prose, so neither may we.
 */
const CANDIDATE = /\[([^\]\n]{1,80})\]/g;

/**
 * The benign allowlist. Every entry is a markdown construct that renders as
 * something other than a blank, and every entry is present on disk today:
 *
 * 1. Task-list checkboxes — docs/templates/handoff-checklist.md and
 *    delivery-review-checklist.md are built out of them.
 * 2. GitHub callouts — [!WARNING], [!TIP], [!NOTE], [!IMPORTANT].
 * 3. Link labels, recognised by the "](" that must follow — [MSA §4.1](...).
 *
 * Nothing else. Note that [GivenTake Devs LLC] is therefore a field, not
 * prose: msa-template.md says the registered entity name must be confirmed,
 * and a client cannot distinguish it from an unfilled blank either.
 */
function isBenign(inner: string, body: string, endIndex: number): boolean {
  if (inner === " " || inner === "x" || inner === "X") return true;
  if (/^![A-Z]+$/.test(inner)) return true;
  return body[endIndex] === "(";
}

export type MergeData = Record<string, string | undefined>;

/**
 * A merge value counts as supplied only when it is a non-empty, non-blank
 * string. hasOwnProperty was not enough: {AMOUNT: undefined} used to stringify
 * into the contract as the literal word "undefined", and an empty string
 * erased the blank without filling it. Both produced a document that looked
 * finished and was not, and both slipped past findUnfilled afterwards.
 */
function isSupplied(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function fillTemplate(body: string, data: MergeData): string {
  return body.replace(CANDIDATE, (whole: string, inner: string, offset: number) => {
    if (isBenign(inner, body, offset + whole.length)) return whole;
    const value = Object.prototype.hasOwnProperty.call(data, inner) ? data[inner] : undefined;
    return isSupplied(value) ? value : whole;
  });
}

/** Placeholders still present, in order of first appearance, deduplicated. */
export function findUnfilled(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(CANDIDATE)) {
    const inner = m[1];
    if (isBenign(inner, body, (m.index ?? 0) + m[0].length)) continue;
    found.add(inner);
  }
  return [...found];
}

/**
 * Attorney-review markers. TWO independent checks, so neither is a single
 * point of failure.
 *
 * includes("[REVIEW]") was one, and it was defeated by every real variation:
 * [REVIEW with CPA] (sow-template.md line 133), [ REVIEW], [review]. The
 * regex covers padding, case and trailing text; the banner covers the whole
 * class of documents that never carried a marker at all.
 */
const REVIEW_MARKER = /\[\s*REVIEW\b[^\]]*\]/i;
const DRAFT_BANNER = /NOT FOR USE WITHOUT ATTORNEY REVIEW/i;

export type FinalizeResult =
  | { ok: true; body: string }
  | { ok: false; reason: "unresolved-review" }
  | { ok: false; reason: "unfilled-placeholders"; placeholders: string[] };

/**
 * Fill a template and refuse to produce anything a client should not see.
 *
 * Both refusals fail closed:
 *
 * 1. An unresolved attorney review blocks finalisation, detected either by a
 *    [REVIEW ...] marker or by the DRAFT banner. This is what stops
 *    docs/contracts/msa-template.md and sow-template.md reaching a client.
 *    Both of those files are un-reviewed today and both are therefore
 *    unsendable — that is the intended behaviour, not a bug to work around.
 * 2. Any placeholder left unfilled blocks the send and is named in the error.
 *    A contract that reaches a client still saying [CLIENT LEGAL NAME] is
 *    worse than no contract.
 *
 * Order matters twice over. Review is reported first because "your document is
 * unfinished" is the wrong message when the real problem is that a lawyer has
 * not seen it. And the review checks run on the RAW body, before filling,
 * because a marker also matches the candidate pattern — checking the filled
 * body would let a caller passing data.REVIEW substitute the marker away and
 * defeat the guard entirely.
 */
export function finalizeDocument(body: string, data: MergeData): FinalizeResult {
  if (REVIEW_MARKER.test(body)) return { ok: false, reason: "unresolved-review" };
  if (DRAFT_BANNER.test(body)) return { ok: false, reason: "unresolved-review" };

  const filled = fillTemplate(body, data);

  const placeholders = findUnfilled(filled);
  if (placeholders.length > 0) return { ok: false, reason: "unfilled-placeholders", placeholders };

  return { ok: true, body: filled };
}
