import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { changeLeadStatus, recordRevenue, reopenLead } from "./leads.functions";
import {
  ISO_4217_CURRENCIES,
  currencyMinorUnits,
  majorAmountToMinor,
  type LeadDetail,
  type LeadStatus,
  type RevenueInput,
} from "./lead.schemas";
import { canTransitionLead, LEAD_STATUSES } from "./lead-state";

type LeadDetailProps = {
  lead: LeadDetail;
  readOnly?: boolean;
  refresh?: () => Promise<void>;
  saveStatus?: (input: { leadId: string; to: LeadStatus }) => Promise<{ status: LeadStatus }>;
  saveRevenue?: (
    input: RevenueInput,
  ) => Promise<Pick<RevenueInput, "amountMinor" | "currency" | "confirmedAt">>;
  saveReopen?: (input: { leadId: string; reason: string }) => Promise<{ status: LeadStatus }>;
};

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export function LeadDetailView({
  lead,
  readOnly = false,
  refresh = async () => {},
  saveStatus = (input) => changeLeadStatus({ data: input }),
  saveRevenue = (input) => recordRevenue({ data: input }),
  saveReopen = (input) => reopenLead({ data: input }),
}: LeadDetailProps) {
  const [status, setStatus] = useState(lead.status);
  const [mutationState, setMutationState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(lead.confirmedRevenueCurrency ?? "USD");
  const [confirmedAt, setConfirmedAt] = useState("");
  const [note, setNote] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  async function updateStatus(to: LeadStatus) {
    setMutationState("saving");
    try {
      const result = await saveStatus({ leadId: lead.id, to });
      setStatus(result.status);
      await refresh();
      setMutationState("saved");
    } catch {
      setMutationState("error");
    }
  }

  async function submitRevenue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationState("saving");
    try {
      await saveRevenue({
        leadId: lead.id,
        amountMinor: majorAmountToMinor(amount, currency),
        currency,
        confirmedAt,
        note: note.trim() || undefined,
      });
      await refresh();
      setMutationState("saved");
    } catch {
      setMutationState("error");
    }
  }

  async function submitReopen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationState("saving");
    try {
      const result = await saveReopen({ leadId: lead.id, reason: reopenReason });
      setStatus(result.status);
      setReopenReason("");
      await refresh();
      setMutationState("saved");
    } catch {
      setMutationState("error");
    }
  }

  const terminal = status === "won" || status === "lost";
  const statusChoices = terminal
    ? [status]
    : LEAD_STATUSES.filter(
        (candidate) => candidate === status || canTransitionLead(status, candidate),
      );

  return (
    <article className="border-t border-slate-300 pt-6">
      <a
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
        href="/leads"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Leads
      </a>

      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-2xl">{lead.name}</h1>
          <p className="mt-1 break-all text-sm text-slate-600">{lead.email}</p>
        </div>
        <p className="m-0 text-sm text-slate-500">Received {dateTime(lead.occurredAt)}</p>
      </header>

      {readOnly ? (
        <p className="mt-5 w-fit border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
          Support session: read-only
        </p>
      ) : null}

      <section aria-labelledby="status-heading" className="mt-7 border-t border-slate-200 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-base font-bold text-slate-950" id="status-heading">
            Status
          </h2>
          {mutationState === "saved" ? (
            <p className="m-0 text-sm text-emerald-700">Saved.</p>
          ) : null}
          {mutationState === "error" ? (
            <p className="m-0 text-sm text-red-700" role="alert">
              The lead could not be updated.
            </p>
          ) : null}
        </div>
        {readOnly ? (
          <p className="mt-3 text-sm font-semibold text-slate-800">{titleCase(status)}</p>
        ) : (
          <div
            aria-label="Lead status"
            className="mt-3 inline-flex max-w-full flex-wrap overflow-hidden rounded border border-slate-300 bg-white"
            role="group"
          >
            {statusChoices.map((candidate) => (
              <button
                aria-pressed={candidate === status}
                className="min-h-9 border-r border-slate-300 px-3 text-sm font-semibold text-slate-700 last:border-r-0 hover:bg-slate-50 aria-pressed:bg-slate-900 aria-pressed:text-white disabled:cursor-wait"
                disabled={candidate === status || mutationState === "saving"}
                key={candidate}
                onClick={() => updateStatus(candidate)}
                type="button"
              >
                {titleCase(candidate)}
              </button>
            ))}
          </div>
        )}

        {terminal && !readOnly ? (
          <form className="mt-5 grid max-w-2xl gap-3" onSubmit={submitReopen}>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
              Reopen reason
              <textarea
                className="min-h-24 resize-y rounded border border-slate-300 bg-white p-3 font-normal outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                maxLength={500}
                minLength={10}
                onChange={(event) => setReopenReason(event.target.value)}
                required
                value={reopenReason}
              />
            </label>
            <button
              className="inline-flex h-9 w-fit items-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-wait"
              disabled={mutationState === "saving"}
              type="submit"
            >
              <RotateCcw aria-hidden="true" size={16} />
              Reopen lead
            </button>
          </form>
        ) : null}
      </section>

      {status === "won" && !readOnly ? (
        <section aria-labelledby="revenue-heading" className="mt-7 border-t border-slate-200 pt-5">
          <h2 className="m-0 text-base font-bold text-slate-950" id="revenue-heading">
            Revenue
          </h2>
          <form className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-3" onSubmit={submitRevenue}>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
              Confirmed revenue
              <input
                className="h-10 rounded border border-slate-300 bg-white px-3 font-normal outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                pattern={
                  currencyMinorUnits(currency) === 0
                    ? "(?:0|[1-9][0-9]*)"
                    : `(?:0|[1-9][0-9]*)(?:\\.[0-9]{1,${currencyMinorUnits(currency)}})?`
                }
                placeholder="3500.00"
                required
                value={amount}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
              Currency
              <select
                className="h-10 rounded border border-slate-300 bg-white px-3 font-normal"
                onChange={(event) => setCurrency(event.target.value)}
                value={currency}
              >
                {ISO_4217_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
              Confirmation date
              <input
                className="h-10 rounded border border-slate-300 bg-white px-3 font-normal"
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setConfirmedAt(event.target.value)}
                required
                type="date"
                value={confirmedAt}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800 sm:col-span-3">
              Internal note (optional)
              <textarea
                className="min-h-20 resize-y rounded border border-slate-300 bg-white p-3 font-normal"
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
                value={note}
              />
            </label>
            <button
              className="inline-flex h-10 w-fit items-center gap-2 rounded bg-[var(--brand-primary)] px-4 text-sm font-semibold text-[var(--brand-on-primary)] disabled:cursor-wait disabled:bg-slate-400"
              disabled={mutationState === "saving"}
              type="submit"
            >
              <Save aria-hidden="true" size={16} />
              Record revenue
            </button>
          </form>
        </section>
      ) : null}

      <section className="mt-7 grid gap-7 border-t border-slate-200 pt-5 lg:grid-cols-2">
        <div>
          <h2 className="m-0 text-base font-bold text-slate-950">Lead details</h2>
          <dl className="mt-4 grid grid-cols-[minmax(7rem,10rem)_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="font-semibold text-slate-600">Company</dt>
            <dd className="m-0 break-words text-slate-900">{lead.company ?? "Not provided"}</dd>
            <dt className="font-semibold text-slate-600">Phone</dt>
            <dd className="m-0 break-words text-slate-900">{lead.phone ?? "Not provided"}</dd>
            <dt className="font-semibold text-slate-600">Budget</dt>
            <dd className="m-0 text-slate-900">{lead.budgetRange}</dd>
            <dt className="font-semibold text-slate-600">Timeline</dt>
            <dd className="m-0 text-slate-900">{lead.timelineRange}</dd>
            <dt className="font-semibold text-slate-600">Declared source</dt>
            <dd className="m-0 text-slate-900">{titleCase(lead.declaredSource)}</dd>
          </dl>
          <h3 className="mt-6 text-sm font-bold text-slate-800">Request notes</h3>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
            {lead.notes}
          </p>
        </div>

        <div>
          <h2 className="m-0 text-base font-bold text-slate-950">Attribution evidence</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["First touch", lead.firstTouch],
                ["Last touch", lead.lastTouch],
              ] as const
            ).map(([label, touch]) => (
              <div className="border-l-2 border-slate-300 pl-3" key={label}>
                <h3 className="m-0 text-sm font-bold text-slate-800">{label}</h3>
                <p className="mb-0 mt-1 text-sm text-slate-700">
                  {touch
                    ? `${touch.source ?? "Unattributed"} / ${titleCase(touch.confidence)} / ${titleCase(touch.state)}`
                    : "No resolved touch"}
                </p>
              </div>
            ))}
          </div>

          <h2 className="mb-0 mt-7 text-base font-bold text-slate-950">Consent receipt</h2>
          <dl className="mt-4 grid grid-cols-[minmax(7rem,10rem)_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="font-semibold text-slate-600">Policy</dt>
            <dd className="m-0 break-words">{lead.consent.policy_version}</dd>
            <dt className="font-semibold text-slate-600">Recorded</dt>
            <dd className="m-0">{dateTime(lead.consent.recorded_at)}</dd>
            <dt className="font-semibold text-slate-600">Analytics</dt>
            <dd className="m-0">{lead.consent.analytics ? "Allowed" : "Not allowed"}</dd>
            <dt className="font-semibold text-slate-600">Marketing</dt>
            <dd className="m-0">{lead.consent.marketing ? "Allowed" : "Not allowed"}</dd>
            <dt className="font-semibold text-slate-600">GPC</dt>
            <dd className="m-0">{lead.consent.gpc ? "Observed" : "Not signaled"}</dd>
          </dl>
        </div>
      </section>

      <section aria-labelledby="audit-heading" className="mt-7 border-t border-slate-200 pt-5">
        <h2 className="m-0 text-base font-bold text-slate-950" id="audit-heading">
          Activity
        </h2>
        <ol className="mt-4 grid list-none gap-0 p-0">
          {lead.audit.map((event, index) => (
            <li
              className="grid grid-cols-[1rem_1fr] gap-3"
              key={`${event.createdAt}-${event.action}`}
            >
              <span className="relative flex justify-center" aria-hidden="true">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-slate-500" />
                {index < lead.audit.length - 1 ? (
                  <span className="absolute bottom-0 top-4 w-px bg-slate-200" />
                ) : null}
              </span>
              <div className="pb-5">
                <p className="m-0 text-sm font-semibold text-slate-800">
                  {titleCase(
                    event.action.replace("lead.", "lead ").replace("revenue.", "revenue "),
                  )}
                </p>
                {event.previousStatus && event.currentStatus ? (
                  <p className="mb-0 mt-1 text-sm text-slate-600">
                    {titleCase(event.previousStatus)} to {titleCase(event.currentStatus)}
                  </p>
                ) : null}
                <time className="mt-1 block text-xs text-slate-500" dateTime={event.createdAt}>
                  {dateTime(event.createdAt)}
                </time>
              </div>
            </li>
          ))}
          {lead.audit.length === 0 ? (
            <li className="text-sm text-slate-500">No activity yet.</li>
          ) : null}
        </ol>
      </section>
    </article>
  );
}
