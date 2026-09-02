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
