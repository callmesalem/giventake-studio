import { createFileRoute } from "@tanstack/react-router";
import { crmContacts } from "@/lib/crm-data";
import { PageHeader, DataTable } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/contacts")({
  loader: () => crmContacts(),
  component: Contacts,
});

function dash(value: string | null) {
  return value ?? <span className="text-muted-foreground">—</span>;
}

function Contacts() {
  const rows = Route.useLoaderData();
  return (
    <div>
      <PageHeader title="Contacts" subtitle={`${rows.length} contacts`} />
      <DataTable
        columns={["Name", "Title", "Company", "Email", "Phone"]}
        rows={rows.map((c) => [
          <span className="font-medium">{c.name}</span>,
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
        ])}
      />
    </div>
  );
}
