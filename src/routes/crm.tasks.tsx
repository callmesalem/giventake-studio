import { createFileRoute } from "@tanstack/react-router";
import { crmTasks } from "@/lib/crm-data";
import { PageHeader, Card, EmptyState, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/tasks")({
  loader: () => crmTasks(),
  component: Tasks,
});

function Tasks() {
  const rows = Route.useLoaderData();
  const open = rows.filter((t) => !t.is_completed);
  const done = rows.filter((t) => t.is_completed);

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`${open.length} open · ${done.length} completed`}
      />
      {open.length === 0 ? (
        <EmptyState>Nothing open. Agent escalations appear here.</EmptyState>
      ) : (
        <div className="space-y-3">
          {open.map((t) => {
            const overdue = t.deadline_at ? new Date(t.deadline_at) < new Date() : false;
            return (
              <Card key={t.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                      {t.content}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {t.source && <Badge value={t.source} />}
                      {t.company && <span>{t.company}</span>}
                      {t.deadline_at && (
                        <span className={overdue ? "font-semibold text-red-600" : ""}>
                          Due {new Date(t.deadline_at).toLocaleDateString()}
                          {overdue ? " · overdue" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
