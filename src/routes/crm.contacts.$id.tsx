import { createFileRoute, useRouter } from "@tanstack/react-router";
import { crmContact, saveContact, setContactNextAction } from "@/lib/crm-data";
import {
  Card,
  DetailHeader,
  DetailLayout,
  Field,
  FieldList,
  Timeline,
  EntityForm,
  Disclosure,
  Badge,
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
          <Card title="Activity">
            <Timeline events={contact.events} />
          </Card>
        }
        aside={
          <>
            <NextStep contact={contact} />
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
            <Card title={`Deals (${contact.deals.length})`}>
              {contact.deals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No deals linked to this contact yet.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {contact.deals.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <a
                        href={`/crm/deals/${d.id}`}
                        className="min-w-0 truncate font-medium underline underline-offset-2"
                      >
                        {d.name}
                      </a>
                      {d.stage ? <Badge value={d.stage} /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        }
      />
    </div>
  );
}

/** The one thing to do next for this person, and when. New leads arrive with
 *  "Reply to new lead" due in four hours (database trigger). */
function NextStep({ contact }: { contact: ReturnType<typeof Route.useLoaderData> }) {
  const router = useRouter();
  const due = contact.next_action_due ? new Date(contact.next_action_due) : null;
  const overdue = due ? due < new Date() : false;
  return (
    <Card title="Next step">
      {contact.next_action ? (
        <div className="mb-3">
          <p className="text-sm font-medium text-foreground">{contact.next_action}</p>
          {due && (
            <p
              className={
                "mt-0.5 text-xs " +
                (overdue ? "font-semibold text-red-600" : "text-muted-foreground")
              }
            >
              {overdue ? "Overdue since " : "Due "}
              {due.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
          <button
            type="button"
            onClick={() =>
              setContactNextAction({
                data: { contactId: contact.id, action: null, due: null },
              }).then(() => router.invalidate())
            }
            className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Mark done
          </button>
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">Nothing scheduled.</p>
      )}
      <Disclosure label={contact.next_action ? "Change" : "Set next step"}>
        <EntityForm
          fields={[
            {
              name: "action",
              label: "Next step",
              required: true,
              placeholder: "Call back about the quote",
            },
            { name: "due", label: "Due", type: "datetime-local" },
          ]}
          submitLabel="Save"
          onSubmit={(data) =>
            setContactNextAction({
              data: { contactId: contact.id, action: data.action, due: data.due || null },
            })
          }
        />
      </Disclosure>
    </Card>
  );
}
