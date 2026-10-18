import type { ReactNode } from "react";
import { formatUsd, type ProposalLine } from "@/lib/proposals";

export type DocLine = Pick<
  ProposalLine,
  | "name"
  | "description"
  | "quantity"
  | "unit"
  | "unit_price_cents"
  | "recurring"
  | "price_is_from"
  | "includes"
  | "excludes"
  | "discount_reason"
>;

const UNIT: Record<string, string> = { each: "", page: " pages", town: " towns", month: " months" };

function amount(l: DocLine): string {
  return `${l.price_is_from ? "from " : ""}${formatUsd(Math.round(l.unit_price_cents * l.quantity))}`;
}

/** The client-facing proposal, shared by the public page and the staff preview,
 *  so what you preview is exactly what the client sees. */
export function ProposalDocument(props: {
  title: string;
  client: string | null;
  summary: string;
  timeline: string;
  validUntil: string | null;
  lines: DocLine[];
  children?: ReactNode;
}) {
  const oneTime = props.lines.filter((l) => !l.recurring);
  const monthly = props.lines.filter((l) => l.recurring);
  const excludes = [...new Set(props.lines.flatMap((l) => l.excludes))];
  const oneTimeCents = Math.max(
    0,
    oneTime.reduce((a, l) => a + Math.round(l.unit_price_cents * l.quantity), 0),
  );
  return (
    <article className="proposal mx-auto max-w-3xl bg-white px-6 py-10 text-ink print:px-0 print:py-0">
      <style>{`@media print { header, footer, nav, .no-print { display: none !important; } body { background: #fff; } .proposal { max-width: none; } }`}</style>
      <p className="text-[13px] font-medium text-violet">GivenTake Devs · Proposal</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.02em]">{props.title}</h1>
      {props.client && <p className="mt-1 text-sm text-muted-ink">Prepared for {props.client}</p>}

      {props.summary && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">What you told us</h2>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{props.summary}</p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">What we&rsquo;ll build</h2>
        <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
          {oneTime.map((l, i) => (
            <li key={i} className="flex justify-between gap-4 py-3">
              <div>
                <p className="font-medium">
                  {l.name}
                  {l.quantity !== 1 && ` × ${l.quantity}${UNIT[l.unit] ?? ""}`}
                </p>
                {l.description && <p className="text-sm text-muted-ink">{l.description}</p>}
                {l.discount_reason && <p className="text-sm text-muted-ink">{l.discount_reason}</p>}
                {l.includes.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-sm text-muted-ink">
                    {l.includes.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="shrink-0 tabular-nums">{amount(l)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-right text-lg font-semibold tabular-nums">
          One-time total {formatUsd(oneTimeCents)}
        </p>
      </section>

      {monthly.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Monthly, after launch</h2>
          <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
            {monthly.map((l, i) => (
              <li key={i} className="flex justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{l.name}</p>
                  {l.includes.length > 0 && (
                    <p className="text-sm text-muted-ink">{l.includes.join(" · ")}</p>
                  )}
                </div>
                <p className="shrink-0 tabular-nums">{amount(l)}/mo</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {excludes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Not included</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted-ink">
            {excludes.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 grid gap-2 text-sm sm:grid-cols-2">
        {props.timeline && (
          <p>
            <span className="font-semibold">Timeline:</span> {props.timeline}
          </p>
        )}
        {props.validUntil && (
          <p>
            <span className="font-semibold">Valid until:</span>{" "}
            {new Date(`${props.validUntil}T12:00:00`).toLocaleDateString()}
          </p>
        )}
      </section>

      {props.children}
    </article>
  );
}
