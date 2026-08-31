import { createFileRoute, Link } from "@tanstack/react-router";
import { crmContacts, crmCompanyOptions, saveContact } from "@/lib/crm-data";
import {
  PageHeader,
  LinkedTable,
  useListFilter,
  EntityForm,
  Disclosure,
  Badge,
} from "@/components/crm/ui";

// Phase 1: Leads / Prospects / Clients are no longer separate tables — they are
// lifecycle stages of a single Contact. Each stage is a filtered view of this
// one page, deep-linkable via ?stage= so the sidebar can point straight at it.
const STAGES = [
  { key: "", label: "All" },
  { key: "lead", label: "Leads" },
  { key: "qualified", label: "Prospects" },
  { key: "customer", label: "Customers" },
  { key: "lost", label: "Lost" },
] as const;

const STAGE_LABEL: Record<string, string> = {
  lead: "Lead",
  qualified: "Prospect",
  customer: "Customer",
  lost: "Lost",
};

export const Route = createFileRoute("/crm/contacts/")({
  validateSearch: (search: Record<string, unknown>) => ({
    stage: typeof search.stage === "string" ? search.stage : "",
  }),
  loader: async () => ({
    rows: await crmContacts(),
    companies: await crmCompanyOptions(),
  }),
  component: Contacts,
});

function dash(value: string | null | undefined) {
  return value ?? <span className="text-muted-foreground">—</span>;
}

function Contacts() {
  const { rows, companies } = Route.useLoaderData();
  const { stage } = Route.useSearch();
  const { session } = Route.useRouteContext();
  const me = session?.userId ?? null;

  const staged = stage ? rows.filter((r) => r.lifecycle_stage === stage) : rows;
  const { filtered, control } = useListFilter(
    staged,
    (r) => [r.name, r.email, r.job_title, r.company].filter(Boolean).join(" "),
    me,
  );

  const heading = STAGES.find((s) => s.key === stage)?.label ?? "Contacts";

  return (
    <div>
      <PageHeader
        title={heading === "All" ? "Contacts" : `Contacts · ${heading}`}
        subtitle={`${staged.length} ${stage ? (STAGE_LABEL[stage]?.toLowerCase() ?? "") : "contact"}${staged.length === 1 ? "" : "s"}`}
        action={
          <Disclosure label="New contact" openLabel="New contact">
            <EntityForm
              fields={[
                { name: "name", label: "Name", required: true },
                {
                  name: "companyId",
                  label: "Company",
                  type: "select" as const,
                  options: companies.map((c) => ({ value: c.id, label: c.name })),
                },
                { name: "jobTitle", label: "Role" },
                { name: "email", label: "Email", type: "email" as const },
                { name: "phone", label: "Phone", type: "tel" as const },
              ]}
              submitLabel="Create contact"
              columns={2}
              onSubmit={(data) => saveContact({ data })}
            />
          </Disclosure>
        }
      />

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Lifecycle stage">
        {STAGES.map((s) => {
          const count = s.key
            ? rows.filter((r) => r.lifecycle_stage === s.key).length
            : rows.length;
          const active = s.key === stage;
          return (
            <Link
              key={s.key || "all"}
              to="/crm/contacts"
              search={{ stage: s.key }}
              className={
                "rounded-full border px-3 py-1 text-sm transition-colors " +
                (active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {s.label} <span className="opacity-70">{count}</span>
            </Link>
          );
        })}
      </nav>

      {control}
      <LinkedTable
        columns={["Name", "Stage", "Title", "Company", "Email", "Phone"]}
        rows={filtered.map((c) => ({
          href: `/crm/contacts/${c.id}`,
          cells: [
            <span className="font-medium">{c.name}</span>,
            <Badge value={STAGE_LABEL[c.lifecycle_stage] ?? c.lifecycle_stage} />,
            dash(c.job_title),
            dash(c.company),
            c.email ? (
              <a href={`mailto:${c.email}`} className="text-primary hover:underline">
                {c.email}
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
            dash(c.phone),
          ],
        }))}
      />
    </div>
  );
}
