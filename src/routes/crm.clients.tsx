import { createFileRoute, redirect } from "@tanstack/react-router";

// Phase 1: Clients are now the "customer" lifecycle stage of Contacts.
// This route is kept only to redirect old bookmarks into the unified view.
export const Route = createFileRoute("/crm/clients")({
  beforeLoad: () => {
    throw redirect({ to: "/crm/contacts", search: { stage: "customer" } });
  },
});
