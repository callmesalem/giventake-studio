import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  crmProposal,
  crmPriceBook,
  saveProposal,
  sendProposal,
  reviseProposal,
} from "@/lib/crm-data";
import {
  effectiveRate,
  formatUsd,
  lineFromItem,
  proposalTotals,
  proposalWarnings,
  type ProposalLine,
} from "@/lib/proposals";
import { PageHeader, Card, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/proposals/$id")({
  loader: async ({ params }) => ({
    proposal: await crmProposal({ data: { id: params.id } }),
    items: await crmPriceBook(),
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    skipped: typeof s.skipped === "string" ? s.skipped : "",
  }),
  component: Builder,
});

const field = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm";

const blank = (patch: Partial<ProposalLine>): ProposalLine => ({
  item_key: null,
  name: "Custom item",
  description: "",
  quantity: 1,
  unit: "each",
  unit_price_cents: 0,
  recurring: false,
  price_is_from: false,
  includes: [],
  excludes: [],
  internal_hours: null,
  needs_discovery: false,
  discount_reason: null,
  ...patch,
});

function Builder() {
  const { proposal, items } = Route.useLoaderData();
  const { skipped } = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate();
  const draft = proposal.status === "draft";
  const [title, setTitle] = useState(proposal.title);
  const [summary, setSummary] = useState(proposal.summary);
  const [timeline, setTimeline] = useState(proposal.timeline);
  const [lines, setLines] = useState<ProposalLine[]>(proposal.lines);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totals = proposalTotals(lines);
  const rate = effectiveRate(lines);
  const warnings = proposalWarnings(lines);
  const blocking = lines.length === 0 || lines.some((l) => l.needs_discovery);
  const set = (i: number, patch: Partial<ProposalLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const save = () =>
    saveProposal({
      data: { id: proposal.id, dealId: proposal.deal_id, title, summary, timeline, lines },
    });

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={`Proposal v${proposal.version}`}
        subtitle={`${proposal.deal_name} · ${proposal.status}`}
      />
      <p className="mb-4 text-sm">
        <a href={`/crm/deals/${proposal.deal_id}`} className="underline underline-offset-2">
          ← Back to deal
        </a>
        {" · "}
        <a href={`/crm/proposals/${proposal.id}/preview`} className="underline underline-offset-2">
          Preview / PDF
        </a>
      </p>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <Card title="Proposal">
            <div className="space-y-3">
              <input
                className={field}
                value={title}
                disabled={!draft}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Title"
              />
              <textarea
                className={field}
                rows={3}
                value={summary}
                disabled={!draft}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="What you told us: their problem, in their words"
                aria-label="What you told us"
              />
              <input
                className={field}
                value={timeline}
                disabled={!draft}
                onChange={(e) => setTimeline(e.target.value)}
                placeholder="Timeline, e.g. 3–4 weeks"
                aria-label="Timeline"
              />
            </div>
          </Card>

          <Card title="Lines">
            {skipped && (
              <p className="mb-2 text-xs text-amber-700">
                Not added (archived or missing from the price book): {skipped.replace(/,/g, ", ")}
              </p>
            )}
            <ul className="space-y-3">
              {lines.map((l, i) => (
                <li key={i} className="rounded-md border border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_80px_120px_auto]">
                    <input
                      className={field}
                      value={l.name}
                      disabled={!draft}
                      onChange={(e) => set(i, { name: e.target.value })}
                      aria-label="Line name"
                    />
                    <input
                      className={field}
                      type="number"
                      min={1}
                      value={l.quantity}
                      disabled={!draft}
                      onChange={(e) =>
                        set(i, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                      }
                      aria-label="Quantity"
                    />
                    <input
                      className={field}
                      type="number"
                      step="1"
                      value={l.unit_price_cents / 100}
                      disabled={!draft}
                      onChange={(e) =>
                        set(i, {
                          unit_price_cents: Math.round(Number(e.target.value) * 100) || 0,
                          needs_discovery: false,
                        })
                      }
                      aria-label="Unit price in dollars"
                    />
                    {draft && (
                      <button
                        type="button"
                        onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                        className="text-xs text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {l.unit_price_cents < 0 && (
                    <input
                      className={`${field} mt-2`}
                      value={l.discount_reason ?? ""}
                      disabled={!draft}
                      onChange={(e) => set(i, { discount_reason: e.target.value })}
                      placeholder="Discount reason (required), e.g. Introductory rate: case-study permission"
                      aria-label="Discount reason"
                    />
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {l.recurring ? "Monthly" : "One-time"} ·{" "}
                    {formatUsd(Math.round(l.unit_price_cents * l.quantity))}
                    {l.needs_discovery && " · quote after discovery: set a price"}
                  </p>
                </li>
              ))}
            </ul>
            {draft && (
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  className={`${field} max-w-xs`}
                  value=""
                  onChange={(e) => {
                    const it = items.find((x) => x.key === e.target.value);
                    if (it) setLines((ls) => [...ls, lineFromItem(it, 1)]);
                  }}
                  aria-label="Add from price book"
                >
                  <option value="">Add from price book…</option>
                  {items
                    .filter((x) => !x.archived)
                    .map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.name} · {formatUsd(x.unit_price_cents)}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                  onClick={() => setLines((ls) => [...ls, blank({})])}
                >
                  Custom line
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                  onClick={() =>
                    setLines((ls) => [
                      ...ls,
                      blank({
                        name: "Introductory rate",
                        unit_price_cents: -10000,
                        discount_reason: "",
                      }),
                    ])
                  }
                >
                  Discount
                </button>
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <Card title="Totals">
            <p className="flex justify-between text-sm">
              One-time{" "}
              <span className="font-semibold tabular-nums">{formatUsd(totals.oneTimeCents)}</span>
            </p>
            <p className="flex justify-between text-sm">
              Monthly <span className="tabular-nums">{formatUsd(totals.monthlyCents)}</span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {rate
                ? `${rate.hours} h · ${formatUsd(rate.rateCents)}/h effective`
                : "Add internal hours to every one-time line (in the price book) to see your effective rate."}
            </p>
            {warnings.map((w) => (
              <p key={w} className="mt-2 text-xs font-medium text-amber-700">
                {w}
              </p>
            ))}
          </Card>

          <Card title="Actions">
            <div className="flex flex-col gap-2">
              <Badge value={proposal.status} />
              {draft && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await save();
                        await router.invalidate();
                      })
                    }
                    className="rounded-md border border-border px-3 py-2 text-sm font-medium"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    disabled={busy || blocking}
                    onClick={() =>
                      run(async () => {
                        await save();
                        const { url } = await sendProposal({ data: { id: proposal.id } });
                        setLink(url);
                        await router.invalidate();
                      })
                    }
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    Send
                  </button>
                </>
              )}
              {["sent", "viewed", "declined", "expired"].includes(proposal.status) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const { id } = await reviseProposal({ data: { id: proposal.id } });
                      await navigate({
                        to: "/crm/proposals/$id",
                        params: { id },
                        search: { skipped: "" },
                      });
                    })
                  }
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium"
                >
                  Revise
                </button>
              )}
              {proposal.accepted_option && (
                <p className="text-xs">
                  Accepted ({proposal.accepted_option}) by {proposal.accepted_name}
                </p>
              )}
              {proposal.decline_reason && (
                <p className="text-xs">Declined: {proposal.decline_reason}</p>
              )}
            </div>
            {link && (
              <div className="mt-3 rounded-md bg-muted/40 p-2 text-xs">
                <p className="font-medium">
                  Save this link: for security it can&rsquo;t be shown again. If it&rsquo;s lost,
                  use Revise to send a fresh version.
                </p>
                <input
                  readOnly
                  className={`${field} mt-1`}
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Proposal link"
                />
                <div className="mt-1 flex gap-3">
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(link)}
                    className="underline"
                  >
                    Copy link
                  </button>
                  <a
                    className="underline"
                    href={`mailto:?subject=${encodeURIComponent(`Your proposal from GivenTake Devs: ${title}`)}&body=${encodeURIComponent(`Here is your proposal:\n\n${link}\n\nIt's valid for 30 days. Reply with any questions.`)}`}
                  >
                    Email it
                  </a>
                </div>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-2 text-xs font-medium text-red-600">
                {error}
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
