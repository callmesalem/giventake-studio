import { createFileRoute } from "@tanstack/react-router";
import { crmContact, saveContact } from "@/lib/crm-data";
import {
  Card,
  DetailHeader,
  DetailLayout,
  Field,
  FieldList,
  Timeline,
  EntityForm,
  Disclosure,
} from "@/components/crm/ui";

export const Route = createFileRoute("/crm/contacts/$id")({
  loader: ({ params }) => crmContact({ data: { id: params.id } }),
  component: Contact,
});

function Contact() {
  const contact = Route.useLoaderData();
  return (
    <div>
      <DetailHeader
        backTo="/crm/contacts"
        backLabel="Contacts"
        title={contact.name}
        subtitle={
          contact.company ? (
            <a
              href={`/crm/companies/${contact.company.id}`}
              className="underline underline-offset-2"
            >
              {contact.company.name}
            </a>
          ) : (
            contact.job_title
          )
        }
        action={
          <Disclosure label="Edit" openLabel={`Edit ${contact.name}`}>
            <EntityForm
              fields={[
                { name: "name", label: "Name", required: true },
                { name: "jobTitle", label: "Role" },
                { name: "email", label: "Email", type: "email" },
                { name: "phone", label: "Phone", type: "tel" },
              ]}
              values={{
                name: contact.name,
                jobTitle: contact.job_title ?? "",
                email: contact.email ?? "",
                phone: contact.phone ?? "",
              }}
              submitLabel="Save changes"
              columns={2}
              onSubmit={(data) =>
                saveContact({
                  data: { ...data, id: contact.id, companyId: contact.company?.id ?? null },
                })
              }
            />
          </Disclosure>
        }
      />
      <DetailLayout
        main={
          <Card title="Activity at this company">
            <Timeline events={contact.events} />
          </Card>
        }
        aside={
          <Card title="Details">
            <FieldList>
              <Field label="Role">{contact.job_title}</Field>
              <Field label="Email">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="underline underline-offset-2">
                    {contact.email}
                  </a>
                ) : null}
              </Field>
              <Field label="Phone">{contact.phone}</Field>
              <Field label="Added">
                {contact.created_at ? new Date(contact.created_at).toLocaleDateString() : null}
              </Field>
            </FieldList>
          </Card>
        }
      />
    </div>
  );
}
