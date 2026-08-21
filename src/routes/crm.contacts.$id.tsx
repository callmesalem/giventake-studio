import { createFileRoute } from "@tanstack/react-router";
import { crmContact } from "@/lib/crm-data";
import { Card, DetailHeader, DetailLayout, Field, FieldList, Timeline } from "@/components/crm/ui";

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
            <a href={`/crm/companies/${contact.company.id}`} className="underline underline-offset-2">
              {contact.company.name}
            </a>
          ) : (
            contact.job_title
          )
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
