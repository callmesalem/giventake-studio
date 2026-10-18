import { createFileRoute } from "@tanstack/react-router";
import { crmPriceBook, savePriceBookItem } from "@/lib/crm-data";
import { formatUsd, type PriceBookItem } from "@/lib/proposals";
import {
  PageHeader,
  Card,
  Disclosure,
  EntityForm,
  Badge,
  type FormFieldDef,
} from "@/components/crm/ui";

export const Route = createFileRoute("/crm/price-book")({
  loader: () => crmPriceBook(),
  component: PriceBook,
});

const CATEGORY_LABEL: Record<PriceBookItem["category"], string> = {
  website: "Websites",
  addon: "Add-ons",
  automation: "Automation",
  monthly: "Monthly",
};
const UNIT_LABEL: Record<PriceBookItem["unit"], string> = {
  each: "",
  page: " / page",
  town: " / town",
  month: " / mo",
};

const FIELDS: FormFieldDef[] = [
  { name: "name", label: "Name", required: true },
  { name: "key", label: "Key (lowercase, e.g. extra_page)", required: true },
  { name: "price", label: "Price (USD)", required: true, placeholder: "149" },
  {
    name: "category",
    label: "Category",
    type: "select",
    required: true,
    options: Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
  },
  {
    name: "unit",
    label: "Unit",
    type: "select",
    required: true,
    options: [
      { value: "each", label: "Each" },
      { value: "page", label: "Per page" },
      { value: "town", label: "Per town" },
      { value: "month", label: "Per month" },
    ],
  },
  { name: "internalHours", label: "Internal hours (never shown to clients)", type: "number" },
  { name: "description", label: "Description", type: "textarea", rows: 2 },
  { name: "includes", label: "Includes (one per line)", type: "textarea", rows: 3 },
  { name: "excludes", label: "Excludes (one per line)", type: "textarea", rows: 3 },
  { name: "priceIsFrom", label: "Show as a 'from' price", type: "checkbox" },
  { name: "archived", label: "Archived", type: "checkbox" },
  { name: "sortOrder", label: "Sort order", type: "number" },
];

function PriceBook() {
  const items = Route.useLoaderData();
  const { session } = Route.useRouteContext();
  const isAdmin = session?.role === "admin";
  const categories = Object.keys(CATEGORY_LABEL) as PriceBookItem["category"][];

  return (
    <div>
      <PageHeader title="Price book" subtitle="The building blocks proposals are priced from." />
      {isAdmin && (
        <div className="mb-5">
          <Disclosure label="New item">
            <EntityForm
              columns={2}
              fields={FIELDS}
              submitLabel="Add item"
              onSubmit={(data) => savePriceBookItem({ data })}
            />
          </Disclosure>
        </div>
      )}
      <div className="space-y-5">
        {categories.map((c) => {
          const group = items.filter((i) => i.category === c);
          return (
            <Card key={c} title={CATEGORY_LABEL[c]}>
              <ul className="divide-y divide-border">
                {group.map((i) => (
                  <li key={i.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {i.name} {i.archived && <Badge value="Archived" />}
                      </p>
                      <p className="text-sm tabular-nums text-foreground">
                        {i.price_is_from ? "from " : ""}
                        {formatUsd(i.unit_price_cents)}
                        {UNIT_LABEL[i.unit]}
                        {i.internal_hours != null && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {i.internal_hours} h
                          </span>
                        )}
                      </p>
                    </div>
                    {i.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{i.description}</p>
                    )}
                    {isAdmin && (
                      <div className="mt-2">
                        <Disclosure label="Edit">
                          <EntityForm
                            columns={2}
                            fields={FIELDS}
                            values={{
                              name: i.name,
                              key: i.key,
                              price: (i.unit_price_cents / 100).toString(),
                              category: i.category,
                              unit: i.unit,
                              internalHours: i.internal_hours ?? "",
                              description: i.description,
                              includes: i.includes.join("\n"),
                              excludes: i.excludes.join("\n"),
                              priceIsFrom: i.price_is_from ? "on" : "",
                              archived: i.archived ? "on" : "",
                              sortOrder: String(i.sort_order),
                            }}
                            submitLabel="Save"
                            onSubmit={(data) => savePriceBookItem({ data: { ...data, id: i.id } })}
                          />
                        </Disclosure>
                      </div>
                    )}
                  </li>
                ))}
                {group.length === 0 && (
                  <li className="py-3 text-sm text-muted-foreground">No items.</li>
                )}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
