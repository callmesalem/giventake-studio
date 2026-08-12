import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { LeadList } from "@/features/leads/lead-list";
import { listLeads } from "@/features/leads/leads.functions";
import { leadListInputSchema } from "@/features/leads/lead.schemas";

export const Route = createFileRoute("/_app/leads")({
  validateSearch: (search) => leadListInputSchema.parse({ limit: 25, ...search }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listLeads({ data: deps }),
  component: LeadListRoute,
});

function LeadListRoute() {
  const page = Route.useLoaderData();
  const filters = Route.useSearch();
  const { supportSession } = getRouteApi("/_app").useLoaderData();
  return <LeadListRouteContent filters={filters} page={page} supportSession={supportSession} />;
}

export function LeadListRouteContent({
  filters,
  page,
  supportSession,
}: {
  filters: Parameters<typeof LeadList>[0]["filters"];
  page: Parameters<typeof LeadList>[0]["page"];
  supportSession: { expiresAt: string } | null;
}) {
  return <LeadList filters={filters} page={page} readOnly={Boolean(supportSession)} />;
}
