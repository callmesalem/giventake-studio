import { createFileRoute } from "@tanstack/react-router";
import { crmSearch } from "@/lib/crm-data";
import { PageHeader, EmptyState, Badge, Card } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => crmSearch({ data: { q: deps.q } }),
  component: Search,
});

function Search() {
  const hits = Route.useLoaderData();
  const { q } = Route.useSearch();

  return (
    <div>
      <PageHeader
        title="Search"
        subtitle={q ? `${hits.length} result${hits.length === 1 ? "" : "s"} for "${q}"` : undefined}
      />
      {!q || q.trim().length < 2 ? (
        <EmptyState>Type at least two characters.</EmptyState>
      ) : hits.length === 0 ? (
        <EmptyState>Nothing matched &ldquo;{q}&rdquo;.</EmptyState>
      ) : (
        <div className="space-y-2">
          {hits.map((hit) => (
            <Card key={`${hit.kind}-${hit.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    href={hit.href}
                    className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {hit.title}
                  </a>
                  {hit.subtitle && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{hit.subtitle}</p>
                  )}
                </div>
                <Badge value={hit.kind} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
