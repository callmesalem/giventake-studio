/**
 * Merge-fill for the [BRACKETED] convention used across docs/contracts and
 * docs/templates. Pure: no I/O, no database, no clock.
 *
 * A placeholder is SHOUTED — [CLIENT LEGAL NAME], [AMOUNT]. That deliberately
 * excludes ordinary prose like "[see below]" and cross-references like "[4]",
 * which appear in the contract text and must not be mistaken for merge fields.
 */
const PLACEHOLDER = /\[([A-Z][A-Z0-9 _-]*)\]/g;

export type MergeData = Record<string, string>;

export function fillTemplate(body: string, data: MergeData): string {
  return body.replace(PLACEHOLDER, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(data, key) ? data[key] : whole,
  );
}

/** Placeholders still present, in order of appearance, deduplicated. */
export function findUnfilled(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(PLACEHOLDER)) found.add(m[1]);
  return [...found];
}

/** Attorney-review flag. Never a merge field, never fillable. */
const REVIEW_MARKER = "[REVIEW]";

export type FinalizeResult =
  | { ok: true; body: string }
  | { ok: false; reason: "unresolved-review" }
  | { ok: false; reason: "unfilled-placeholders"; placeholders: string[] };

/**
 * Fill a template and refuse to produce anything a client should not see.
 *
 * Two refusals, both fail-closed:
 *
 * 1. [REVIEW] blocks finalisation. docs/contracts/msa-template.md opens
 *    "DRAFT - NOT FOR USE WITHOUT ATTORNEY REVIEW" and marks specific clauses
 *    [REVIEW]. This is what stops that file reaching a client, without a
 *    separate mechanism someone has to remember to maintain.
 * 2. Any placeholder left unfilled blocks the send and is named in the error. A
 *    contract that reaches a client still saying [CLIENT LEGAL NAME] is worse
 *    than no contract.
 *
 * Order matters twice over. Review is reported first because "your document is
 * unfinished" is the wrong message when the real problem is that a lawyer has
 * not seen it. And the review check runs on the RAW body, before filling,
 * because [REVIEW] matches the placeholder pattern - checking the filled body
 * would let a caller passing data.REVIEW substitute the marker away and defeat
 * the guard entirely.
 */
export function finalizeDocument(body: string, data: MergeData): FinalizeResult {
  if (body.includes(REVIEW_MARKER)) return { ok: false, reason: "unresolved-review" };

  const filled = fillTemplate(body, data);

  const placeholders = findUnfilled(filled);
  if (placeholders.length > 0) return { ok: false, reason: "unfilled-placeholders", placeholders };

  return { ok: true, body: filled };
}
