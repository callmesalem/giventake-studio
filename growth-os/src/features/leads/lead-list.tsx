import { Filter, RefreshCw, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { searchLeads } from "./leads.functions";
import {
  formatMinorAmount,
  type LeadListPage,
  type LeadLookupInput,
  type LeadStatus,
} from "./lead.schemas";

type NonPiiFilters = {
  status?: LeadStatus;
  source?: string;
  from?: string;
  to?: string;
};

type LeadListProps = {
  page: LeadListPage;
  filters?: NonPiiFilters;
  readOnly?: boolean;
  lookupLeads?: (input: LeadLookupInput) => Promise<LeadListPage>;
};

const statusStyles: Record<LeadStatus, string> = {
  new: "border-sky-200 bg-sky-50 text-sky-800",
  qualified: "border-teal-200 bg-teal-50 text-teal-800",
  booked: "border-amber-200 bg-amber-50 text-amber-900",
  won: "border-emerald-200 bg-emerald-50 text-emerald-800",
  lost: "border-slate-300 bg-slate-100 text-slate-700",
};

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatRevenue(amount: string | null, currency: string | null) {
  return amount && currency ? formatMinorAmount(amount, currency) : "Not recorded";
}

function nextPageHref(filters: NonPiiFilters, cursor: string) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) parameters.set(key, value);
  }
  parameters.set("cursor", cursor);
  return `/leads?${parameters.toString()}`;
}

function lookupInput(
  filters: NonPiiFilters,
  exactEmail: string,
  exactPhone: string,
  cursor?: string,
): LeadLookupInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(exactEmail.trim() ? { exactEmail: exactEmail.trim() } : {}),
    ...(exactPhone.trim() ? { exactPhone: exactPhone.trim() } : {}),
    ...(cursor ? { cursor } : {}),
    limit: 25,
  };
}

export function LeadList({
  page,
  filters = {},
  readOnly = false,
  lookupLeads = (input) => searchLeads({ data: input }),
}: LeadListProps) {
  const [filtersVisible, setFiltersVisible] = useState(
    Boolean(filters.status || filters.source || filters.from || filters.to),
  );
  const [exactEmail, setExactEmail] = useState("");
  const [exactPhone, setExactPhone] = useState("");
  const [lookupPage, setLookupPage] = useState<LeadListPage | null>(null);
  const [activeLookup, setActiveLookup] = useState<LeadLookupInput | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  async function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = lookupInput(filters, exactEmail, exactPhone);
    setLookupPending(true);
    try {
      setLookupPage(await lookupLeads(input));
      setActiveLookup(input);
    } finally {
      setLookupPending(false);
    }
  }

  async function nextLookupPage() {
    if (!lookupPage?.nextCursor || !activeLookup) return;
    const input = { ...activeLookup, cursor: lookupPage.nextCursor };
    setLookupPending(true);
    try {
      setLookupPage(await lookupLeads(input));
      setActiveLookup(input);
    } finally {
      setLookupPending(false);
    }
  }

  const displayedPage = lookupPage ?? page;

  return (
    <section aria-labelledby="lead-list-title" className="border-t border-slate-300 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl" id="lead-list-title">
              Leads
            </h1>
            {readOnly ? (
              <span className="border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                Support session: read-only
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {displayedPage.items.length} leads in this page
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-2">
          <form
            aria-label="Exact lead lookup"
            className="flex min-w-0 flex-1 justify-end gap-2"
            method="post"
            onSubmit={submitLookup}
          >
            <label className="sr-only" htmlFor="lead-email-search">
              Exact email
            </label>
            <input
              className="h-9 min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 sm:max-w-72"
              id="lead-email-search"
              onChange={(event) => setExactEmail(event.target.value)}
              placeholder="Exact email"
              type="email"
              value={exactEmail}
            />
            <label className="sr-only" htmlFor="lead-phone-search">
              Exact phone
            </label>
            <input
              className="h-9 min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 sm:max-w-56"
              id="lead-phone-search"
              maxLength={32}
              onChange={(event) => setExactPhone(event.target.value)}
              placeholder="Exact phone"
              type="tel"
              value={exactPhone}
            />
            <button
              aria-label="Search leads"
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
              disabled={lookupPending || (!exactEmail.trim() && !exactPhone.trim())}
              title="Search leads"
              type="submit"
            >
              <Search aria-hidden="true" size={17} />
            </button>
          </form>
          <button
            aria-expanded={filtersVisible}
            aria-label="Filter leads"
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => setFiltersVisible((visible) => !visible)}
            title="Filter leads"
            type="button"
          >
            <Filter aria-hidden="true" size={17} />
          </button>
          <button
            aria-label="Refresh leads"
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => window.location.reload()}
            title="Refresh leads"
            type="button"
          >
            <RefreshCw aria-hidden="true" size={17} />
          </button>
        </div>
      </div>

      {filtersVisible ? (
        <form
          className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-4"
          method="get"
        >
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Status
            <select
              className="h-9 rounded border border-slate-300 bg-white px-2 text-sm font-normal"
              defaultValue={filters.status ?? ""}
              name="status"
            >
              <option value="">All statuses</option>
              {(["new", "qualified", "booked", "won", "lost"] as const).map((status) => (
                <option key={status} value={status}>
                  {titleCase(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Source
            <input
              className="h-9 rounded border border-slate-300 bg-white px-2 text-sm font-normal"
              defaultValue={filters.source}
              maxLength={80}
              name="source"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Received from
            <input
              className="h-9 rounded border border-slate-300 bg-white px-2 text-sm font-normal"
              defaultValue={filters.from}
              name="from"
              type="date"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Received through
            <input
              className="h-9 rounded border border-slate-300 bg-white px-2 text-sm font-normal"
              defaultValue={filters.to}
              name="to"
              type="date"
            />
          </label>
          <button
            className="h-9 w-fit rounded bg-slate-900 px-3 text-sm font-semibold text-white"
            type="submit"
          >
            Apply filters
          </button>
        </form>
      ) : null}

      <div className="mt-5 overflow-x-auto border-y border-slate-200 bg-white">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              {[
                "Lead",
                "Status",
                "Received",
                "Source",
                "Confidence",
                "Last activity",
                "Confirmed revenue",
              ].map((heading) => (
                <th className="border-b border-slate-200 px-3 py-2.5" key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedPage.items.map((lead) => (
              <tr
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                key={lead.id}
              >
                <td className="px-3 py-3">
                  <a
                    className="font-semibold text-slate-950 hover:text-teal-800"
                    href={`/leads/${lead.id}`}
                  >
                    {lead.name}
                  </a>
                  <div className="mt-0.5 text-xs text-slate-500">{lead.email}</div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${statusStyles[lead.status]}`}
                  >
                    {titleCase(lead.status)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                  {formatDate(lead.occurredAt)}
                </td>
                <td className="px-3 py-3 text-slate-700">{titleCase(lead.declaredSource)}</td>
                <td className="px-3 py-3 text-slate-700">{titleCase(lead.confidence)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                  {formatDate(lead.lastActivityAt)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-800">
                  {formatRevenue(lead.confirmedRevenueMinor, lead.confirmedRevenueCurrency)}
                </td>
              </tr>
            ))}
            {displayedPage.items.length === 0 ? (
              <tr>
                <td className="px-3 py-10 text-center text-slate-500" colSpan={7}>
                  No leads match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {displayedPage.nextCursor ? (
        <div className="mt-4 flex justify-end">
          {lookupPage ? (
            <button
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              disabled={lookupPending}
              onClick={nextLookupPage}
              type="button"
            >
              Next page
            </button>
          ) : (
            <a
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-50"
              href={nextPageHref(filters, displayedPage.nextCursor)}
            >
              Next page
            </a>
          )}
        </div>
      ) : null}
    </section>
  );
}
