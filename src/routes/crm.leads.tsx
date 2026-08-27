import { createFileRoute, redirect } from "@tanstack/react-router";

// Phase 1: Leads are now a lifecycle stage of Contacts, not a separate page.
// This route is kept only to redirect old bookmarks into the unified view.
export const Route = createFileRoute("/crm/leads")({
  beforeLoad: () => {
    throw redirect({ to: "/crm/contacts", search: { stage: "lead" } });
  },
});
