/**
 * Merge fields for campaign steps: the closed set a template may use, a check
 * that refuses anything else at authoring time, and the renderer the runner
 * uses at send time.
 *
 * Closed on purpose. Before this, render() substituted {{name}} only, so any
 * other token - {{company}}, {{firstName}} - reached a live prospect's subject
 * line raw. Refusing unknown tokens when the step is SAVED is what keeps that
 * from ever happening again; the renderer still leaves unknown tokens alone so
 * a bad row cannot throw inside the tick.
 *
 * In src/lib/ because both the CRM form (browser) and the runner (Worker) use
 * it, and it touches nothing server-only.
 */
export const MERGE_FIELDS = ["name", "firstName", "company"] as const;

export type MergeField = (typeof MERGE_FIELDS)[number];

export interface MergeContext {
  name: string | null | undefined;
  company: string | null | undefined;
}

const TOKEN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Every {{token}} in the template that is not a supported merge field. */
export function unknownMergeFields(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(TOKEN)) {
    const token = match[1];
    if (!(MERGE_FIELDS as readonly string[]).includes(token)) found.add(token);
  }
  return [...found];
}

function valueFor(field: MergeField, ctx: MergeContext): string {
  const name = ctx.name?.trim() || "";
  switch (field) {
    case "name":
      return name || "there";
    case "firstName":
      return name.split(/\s+/)[0] || "there";
    case "company":
      return ctx.company?.trim() || "your business";
  }
}

/**
 * The replacement is a function, not a string: a lead named `Marks & Co` or
 * anything containing `$&`, `$'` or `$1` would otherwise be reinterpreted as a
 * replacement pattern and mangle the greeting on a real prospect's email.
 */
export function renderTemplate(template: string, ctx: MergeContext): string {
  return template.replace(TOKEN, (whole, token: string) =>
    (MERGE_FIELDS as readonly string[]).includes(token)
      ? valueFor(token as MergeField, ctx)
      : whole,
  );
}
