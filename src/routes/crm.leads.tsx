import { createFileRoute } from "@tanstack/react-router";
import { crmLeads, createLead } from "@/lib/crm-data";
import {
  PageHeader,
  LinkedTable,
  Badge,
  useListFilter,
  EntityForm,
  Disclosure,
} from "@/components/crm/ui";

export const Route = createFileRoute("/crm/leads")({
  loader: () => crmLeads(),
  component: Leads,
});

function dash(value: string | null) {
  return value ?? <span className="text-muted-foreground">—</span>;
}

function when(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function Leads() {
  const rows = Route.useLoaderData();
  const { session } = Route.useRouteContext();
  const me = session?.userId ?? null;
  const { filtered, control } = useListFilter(
    rows,
    (r) => [r.name, r.email, r.company, r.status, r.source].filter(Boolean).join(" "),
    me,
  );
  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${rows.length} leads from the website and inbound sources`}
        action={
          <Disclosure label="New lead" openLabel="New lead">
            <EntityForm
              fields={[
                { name: "name", label: "Name", required: true },
                { name: "email", label: "Email", type: "email" as const, required: true },
                { name: "company", label: "Company" },
                { name: "source", label: "Source", placeholder: "how they reached you" },
                { name: "description", label: "Notes", type: "textarea" as const, rows: 3 },
              ]}
              submitLabel="Create lead"
              columns={2}
              onSubmit={(data) => createLead({ data })}
            />
          </Disclosure>
        }
      />
      {control}
      <LinkedTable
        columns={["Name", "Company", "Email", "Status", "Source", "Budget", "Score", "Captured"]}
        rows={filtered.map((l) => ({
          href: `/crm/leads/${l.id}`,
          cells: [
            <span className="font-medium">{l.name ?? "(no name)"}</span>,
            dash(l.company),
            l.email ? (
              <a href={`mailto:${l.email}`} className="text-primary hover:underline">
                {l.email}
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
            l.status ? (
              <Badge value={l.status} />
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
            dash(l.source),
            dash(l.budget),
            l.score ? <Badge value={l.score} /> : <span className="text-muted-foreground">—</span>,
            <span className="whitespace-nowrap text-muted-foreground">{when(l.created_at)}</span>,
          ],
        }))}
      />
    </div>
  );
}
