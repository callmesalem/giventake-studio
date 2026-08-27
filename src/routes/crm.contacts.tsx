import { createFileRoute } from "@tanstack/react-router";
import { crmContacts, crmCompanyOptions, saveContact } from "@/lib/crm-data";
import { PageHeader, LinkedTable, useListFilter, EntityForm, Disclosure } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/contacts")({
  loader: async () => ({
    rows: await crmContacts(),
    companies: await crmCompanyOptions(),
  }),
  component: Contacts,
});

function dash(value: string | null) {
  return value ?? <span className="text-muted-foreground">—</span>;
}

function Contacts() {
  const { rows, companies } = Route.useLoaderData();
  const { session } = Route.useRouteContext();
  const me = session?.userId ?? null;
  const { filtered, control } = useListFilter(
    rows,
    (r) => [r.name, r.email, r.job_title, r.company].filter(Boolean).join(" "),
    me,
  );
  return (
    <div>
      <PageHeader title="Contacts" subtitle={`${rows.length} contacts`} action={
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
      {control}
      <LinkedTable
        columns={["Name", "Title", "Company", "Email", "Phone"]}
        rows={filtered.map((c) => ({ href: `/crm/contacts/${c.id}`, cells: [
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
        ] }))}
      />
    </div>
  );
}
