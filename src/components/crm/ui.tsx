import { useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      {title && (
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) {
    return <EmptyState>Nothing here yet.</EmptyState>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-2.5 font-medium text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
              {cells.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RISK_STYLES: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-900",
  high: "bg-red-100 text-red-800",
  critical: "bg-red-200 text-red-900",
};

export function Badge({ value, kind = "neutral" }: { value: string; kind?: "neutral" | "risk" }) {
  const style =
    kind === "risk"
      ? (RISK_STYLES[value.toLowerCase()] ?? "bg-muted text-muted-foreground")
      : "bg-muted text-foreground";
  return (
    <span
      className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", style)}
    >
      {value}
    </span>
  );
}

/* ── Phase 01 additions ─────────────────────────────────────────────────────
 * Detail-page scaffolding. Mobile-first throughout: single column by default,
 * the sidebar only appears once there is room for it.
 */

/** Back link + title + optional status line, for a single record. */
export function DetailHeader({
  backTo,
  backLabel,
  title,
  subtitle,
  badge,
  action,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <a
        href={backTo}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden="true">&larr;</span> {backLabel}
      </a>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {subtitle && (
            <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {action}
        </div>
      </div>
    </div>
  );
}

/** Label/value pair. Values wrap rather than truncate — on a phone a truncated
 *  email is worse than a two-line one. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">
        {empty ? <span className="text-muted-foreground">&mdash;</span> : children}
      </dd>
    </div>
  );
}

export function FieldList({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-border">{children}</dl>;
}

/** Two-column on desktop, stacked on mobile. Detail first in DOM order so the
 *  record itself is what a phone shows before the side panel. */
export function DetailLayout({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">{main}</div>
      <div className="space-y-5">{aside}</div>
    </div>
  );
}

const TIMELINE_TONE: Record<string, string> = {
  touchpoint: "bg-blue-500",
  agent: "bg-violet-500",
  note: "bg-amber-500",
  stage: "bg-emerald-500",
  task: "bg-slate-400",
};

export interface TimelineItem {
  id: string;
  at: string | null;
  kind: string;
  title: string;
  detail: string | null;
  actor: string | null;
}

/** Everything that happened to a record, newest first, from whichever table
 *  recorded it. The dot colour encodes the source so agent activity is
 *  distinguishable from human activity at a glance. */
export function Timeline({ events }: { events: TimelineItem[] }) {
  if (!events.length) {
    return <EmptyState>Nothing has happened here yet.</EmptyState>;
  }
  return (
    <ol className="relative space-y-0">
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < events.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute left-[5px] top-4 h-full w-px bg-border"
            />
          )}
          <span
            aria-hidden="true"
            className={cn(
              "relative mt-1.5 h-[11px] w-[11px] flex-none rounded-full ring-2 ring-card",
              TIMELINE_TONE[e.kind] ?? "bg-slate-400",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-sm font-medium text-foreground">{e.title}</p>
              {e.actor && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {e.actor}
                </span>
              )}
            </div>
            {e.detail && (
              <p className="mt-0.5 break-words text-sm text-muted-foreground">{e.detail}</p>
            )}
            {e.at && (
              <time className="mt-1 block text-xs tabular-nums text-muted-foreground">
                {new Date(e.at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A table whose rows navigate. Kept separate from DataTable so existing
 *  read-only tables are untouched. */
export function LinkedTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: { href: string; cells: ReactNode[] }[];
}) {
  if (!rows.length) return <EmptyState>Nothing here yet.</EmptyState>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map((c) => (
              <th
                key={c}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.href} className="group hover:bg-muted/40">
              {row.cells.map((cell, i) => (
                <td key={i} className="px-4 py-2.5 align-top">
                  {i === 0 ? (
                    <a
                      href={row.href}
                      className="font-medium text-foreground underline-offset-2 group-hover:underline"
                    >
                      {cell}
                    </a>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Phase 02: writing ──────────────────────────────────────────────────────
 * A small form kit. One generic EntityForm drives create and edit for every
 * record type, so adding a field is a data change rather than another copy of
 * the same JSX.
 */

export interface FormFieldDef {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "textarea" | "select" | "date" | "checkbox";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  help?: string;
  rows?: number;
}

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground " +
  "outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60";

export function FormControl({
  field,
  defaultValue,
  error,
}: {
  field: FormFieldDef;
  defaultValue?: string | number | null;
  error?: string;
}) {
  const id = `f-${field.name}`;
  const common = {
    id,
    name: field.name,
    required: field.required,
    placeholder: field.placeholder,
    defaultValue: defaultValue ?? "",
    className: inputClass,
    "aria-invalid": error ? true : undefined,
  } as const;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-foreground">
        {field.label}
        {field.required && <span className="ml-0.5 text-muted-foreground">*</span>}
      </label>

      {field.type === "checkbox" ? (
        // An unticked box is omitted from FormData entirely, so the server
        // treats absence as false. Same shape the contact form learned to
        // handle today.
        <input
          id={id}
          name={field.name}
          type="checkbox"
          defaultChecked={defaultValue === "on" || defaultValue === "true"}
          className="h-4 w-4"
        />
      ) : field.type === "textarea" ? (
        <textarea {...common} rows={field.rows ?? 4} />
      ) : field.type === "select" ? (
        <select {...common}>
          <option value="">&mdash;</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input {...common} type={field.type ?? "text"} />
      )}

      {field.help && !error && <p className="text-xs text-muted-foreground">{field.help}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Create/edit form. Submits a plain FormData object to `onSubmit`, which is a
 *  server function — no client-side data layer to keep in sync. */
export function EntityForm({
  fields,
  values,
  submitLabel,
  onSubmit,
  onCancel,
  columns = 1,
}: {
  fields: FormFieldDef[];
  values?: Record<string, unknown>;
  submitLabel: string;
  onSubmit: (data: Record<string, string>) => Promise<unknown>;
  onCancel?: () => void;
  columns?: 1 | 2;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(data);
      form.reset();
      // A full reload keeps the page authoritative. Optimistic local state would
      // be faster and would also let the screen disagree with the database,
      // which for a CRM is the worse trade.
      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "That didn't save. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <div className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2")}>
        {fields.map((f) => (
          <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
            <FormControl field={f} defaultValue={values?.[f.name] as string | undefined} />
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/** A form hidden behind a button until wanted. Keeps list pages uncluttered
 *  while still offering a create action on every one of them. */
export function Disclosure({
  label,
  children,
  openLabel,
}: {
  label: string;
  children: ReactNode;
  openLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
      >
        {label}
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{openLabel ?? label}</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>
      {children}
    </div>
  );
}

/* ── Phase 07: assignment ───────────────────────────────────────────────── */

export interface AssignableMember {
  userId: string;
  email: string;
  fullName: string;
}

/** Who owns this record. Unassigned is a first-class option, not an accident:
 *  an agent-sourced company nobody has picked up SHOULD read as unowned rather
 *  than being silently attributed to whoever opened it. */
export function OwnerPicker({
  members,
  value,
  onChange,
  label = "Owner",
}: {
  members: AssignableMember[];
  value: string | null;
  onChange: (userId: string | null) => Promise<unknown>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select
        value={value ?? ""}
        disabled={busy}
        onChange={async (event) => {
          const next = event.target.value === "" ? null : event.target.value;
          setBusy(true);
          setError(null);
          try {
            await onChange(next);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save that.");
          } finally {
            setBusy(false);
          }
        }}
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.fullName || m.email}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/* ── Phase 08: list filtering ───────────────────────────────────────────── */

export interface Ownable {
  owner_id?: string | null;
  assigned_to?: string | null;
}

/** Text filter plus a mine/all switch, applied in the browser.
 *
 *  Client-side because these lists are capped at 500 rows server-side, so the
 *  data is already present and a round trip per keystroke would be slower and
 *  no more correct. If a list ever outgrows that cap this has to move to the
 *  query - the cap is the thing to watch, not the filter. */
export function useListFilter<T extends Ownable>(
  rows: T[],
  toText: (row: T) => string,
  currentUserId: string | null,
) {
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const needle = query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (mineOnly && currentUserId) {
      const mine = row.owner_id === currentUserId || row.assigned_to === currentUserId;
      if (!mine) return false;
    }
    if (!needle) return true;
    return toText(row).toLowerCase().includes(needle);
  });

  const control = (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter…"
        aria-label="Filter this list"
        className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
      />
      {currentUserId && (
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Mine only
        </label>
      )}
      {(needle || mineOnly) && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {filtered.length} of {rows.length}
        </span>
      )}
    </div>
  );

  return { filtered, control };
}
