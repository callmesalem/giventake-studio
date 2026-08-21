import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { crmTasks, setTaskCompleted } from "@/lib/crm-data";
import { PageHeader, Card, EmptyState, Badge } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/tasks")({
  loader: () => crmTasks(),
  component: Tasks,
});

function TaskRowView({ task }: { task: ReturnType<typeof Route.useLoaderData>[number] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const overdue = task.deadline_at ? new Date(task.deadline_at) < new Date() : false;

  async function toggle() {
    setBusy(true);
    try {
      await setTaskCompleted({ data: { id: task.id, isCompleted: !task.is_completed } });
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={task.is_completed}
          onChange={toggle}
          disabled={busy}
          aria-label={task.is_completed ? "Reopen task" : "Complete task"}
          className="mt-0.5 h-4 w-4 flex-none"
        />
        <div className="min-w-0 flex-1">
          <p
            className={
              "whitespace-pre-wrap break-words text-sm " +
              (task.is_completed ? "text-muted-foreground line-through" : "text-foreground")
            }
          >
            {task.content}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.source && <Badge value={task.source} />}
            {task.company && <span>{task.company}</span>}
            {task.deadline_at && (
              <span className={overdue && !task.is_completed ? "font-semibold text-red-600" : ""}>
                Due {new Date(task.deadline_at).toLocaleDateString()}
                {overdue && !task.is_completed ? " · overdue" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Tasks() {
  const rows = Route.useLoaderData();
  const open = rows.filter((t) => !t.is_completed);
  const done = rows.filter((t) => t.is_completed);

  return (
    <div>
      <PageHeader title="Tasks" subtitle={`${open.length} open · ${done.length} completed`} />
      {open.length === 0 && done.length === 0 ? (
        <EmptyState>Nothing here yet. Agent escalations appear on this page.</EmptyState>
      ) : (
        <div className="space-y-5">
          <div className="space-y-3">
            {open.map((t) => (
              <TaskRowView key={t.id} task={t} />
            ))}
          </div>
          {done.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">
                {done.length} completed
              </summary>
              <div className="mt-3 space-y-3">
                {done.map((t) => (
                  <TaskRowView key={t.id} task={t} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
