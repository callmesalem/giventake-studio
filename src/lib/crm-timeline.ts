/**
 * Pure timeline shaping shared by the CRM server functions.
 *
 * Like crm-guards, this module touches no network, request, or environment, so
 * it is loadable by a test. crm-data.ts imports the type and the shapers from
 * here; the fetching stays server-side there.
 */

export interface TimelineEvent {
  id: string;
  at: string | null;
  kind: "touchpoint" | "agent" | "note" | "stage" | "task" | "deal";
  title: string;
  detail: string | null;
  actor: string | null;
}

export const byNewestFirst = (a: TimelineEvent, b: TimelineEvent) =>
  (b.at ?? "").localeCompare(a.at ?? "");

/** Human label for a snake/kebab key: website_contact_form -> Website contact form. */
export function humanise(value: string | null): string {
  if (!value) return "Activity";
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function s(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function n(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** A contact's own deals as timeline events. Pure so it can be tested without a
 *  database: crmContact fetches the rows, this shapes them. Each deal shows as
 *  one event at its creation time, titled with its name and current stage, so a
 *  hire opening a contact sees that person's pipeline, not just company notes. */
export function contactDealEvents(deals: Array<Record<string, unknown>>): TimelineEvent[] {
  return deals.map((d) => {
    const stage = s(d.stage);
    const value = n(d.value_usd);
    const detail = [
      stage ? `Stage: ${humanise(stage)}` : null,
      value != null ? usdWhole.format(value) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      id: `dl-${String(d.id)}`,
      at: s(d.created_at),
      kind: "deal" as const,
      title: s(d.name) ?? "Deal",
      detail: detail || null,
      actor: null,
    };
  });
}
