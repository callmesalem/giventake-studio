import { Filter, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import type { LeadListPage, LeadStatus } from "./lead.schemas";

type LeadListProps = {
  page: LeadListPage;
  filters?: {
    status?: LeadStatus;
    source?: string;
    exactEmail?: string;
    exactPhone?: string;
    from?: string;
    to?: string;
  };
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
  if (!amount || !currency) return "Not recorded";
  const minor = BigInt(amount);
  const whole = minor / 100n;
  const fraction = (minor % 100n).toString().padStart(2, "0");
  return `${currency} ${whole.toLocaleString("en-US")}.${fraction}`;
}

function nextPageHref(filters: LeadListProps["filters"], cursor: string) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value) parameters.set(key, value);
  }
  parameters.set("cursor", cursor);
  return `/leads?${parameters.toString()}`;
}

export function LeadList({ page, filters = {} }: LeadListProps) {
  const [filtersVisible, setFiltersVisible] = useState(
    Boolean(filters.status || filters.source || filters.from || filters.to || filters.exactPhone),
  );

  return (
    <section aria-labelledby="lead-list-title" className="border-t border-slate-300 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl" id="lead-list-title">
            Leads
          </h1>
          <p className="mt-1 text-sm text-slate-600">{page.items.length} leads in this page</p>
        </div>
        <form className="flex min-w-0 flex-1 flex-wrap justify-end gap-2" method="get">
          <label className="sr-only" htmlFor="lead-email-search">
            Exact email
          </label>
          <input
            className="h-9 min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 sm:max-w-72"
            defaultValue={filters.exactEmail}
            id="lead-email-search"
            name="exactEmail"
            placeholder="Exact email"
            type="email"
          />
          <button
            aria-label="Search leads"
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            title="Search leads"
            type="submit"
          >
            <Search aria-hidden="true" size={17} />
          </button>
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

          {filtersVisible ? (
            <div className="grid w-full gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-5">
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
                Exact phone
                <input
                  className="h-9 rounded border border-slate-300 bg-white px-2 text-sm font-normal"
                  defaultValue={filters.exactPhone}
                  maxLength={32}
                  name="exactPhone"
                  type="tel"
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
            </div>
          ) : null}
        </form>
      </div>

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
            {page.items.map((lead) => (
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
            {page.items.length === 0 ? (
              <tr>
                <td className="px-3 py-10 text-center text-slate-500" colSpan={7}>
                  No leads match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {page.nextCursor ? (
        <div className="mt-4 flex justify-end">
          <a
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-50"
            href={nextPageHref(filters, page.nextCursor)}
          >
            Next page
          </a>
        </div>
      ) : null}
    </section>
  );
}
