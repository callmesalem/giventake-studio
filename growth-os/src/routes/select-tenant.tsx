import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import {
  getRouteSession,
  listAvailableTenants,
  selectTenant,
} from "@/features/tenants/tenant-context.functions";

type TenantOption = {
  id: string;
  displayName: string;
  access: "client_owner" | "platform_admin";
};

type TenantSelectionFormProps = {
  tenants: TenantOption[];
  chooseTenant?: (input: { tenantId: string }) => Promise<{ selected: true }>;
  onSelected?: () => void;
};

export function TenantSelectionForm({
  tenants,
  chooseTenant = (input) => selectTenant({ data: input }),
  onSelected = () => window.location.assign("/"),
}: TenantSelectionFormProps) {
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function handleSelection(tenantId: string) {
    setPendingTenantId(tenantId);
    setFailed(false);
    try {
      await chooseTenant({ tenantId });
      onSelected();
    } catch {
      setFailed(true);
      setPendingTenantId(null);
    }
  }

  if (tenants.length === 0) {
    return <p className="m-0 text-sm leading-6 text-slate-700">No active tenant is available.</p>;
  }

  return (
    <div className="grid gap-3">
      {tenants.map((tenant) => (
        <button
          aria-label={`Continue with ${tenant.displayName}`}
          className="flex min-h-14 items-center justify-between rounded border border-slate-300 bg-white px-4 py-3 text-left hover:border-teal-700 disabled:cursor-wait disabled:bg-slate-100"
          disabled={pendingTenantId !== null}
          key={tenant.id}
          onClick={() => handleSelection(tenant.id)}
          type="button"
        >
          <span className="min-w-0 font-semibold text-slate-950">{tenant.displayName}</span>
          <span className="ml-4 shrink-0 text-xs text-slate-500">
            {tenant.access === "platform_admin" ? "Support" : "Owner"}
          </span>
        </button>
      ))}
      {failed ? (
        <p className="m-0 text-sm text-red-700" role="alert">
          That tenant could not be selected.
        </p>
      ) : null}
    </div>
  );
}

function TenantSelectionRoute() {
  const tenants = Route.useLoaderData();
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-16">
      <section className="mx-auto w-full max-w-lg border-t border-slate-300 pt-8">
        <p className="mb-2 text-sm font-bold uppercase text-teal-700">Growth OS</p>
        <h1 className="mb-3 text-2xl font-bold text-slate-950">Select tenant</h1>
        <p className="mb-7 text-sm leading-6 text-slate-600">Choose the workspace to open.</p>
        <TenantSelectionForm tenants={tenants} />
      </section>
    </main>
  );
}

export const Route = createFileRoute("/select-tenant")({
  beforeLoad: async () => {
    const session = await getRouteSession();
    if (!session.authenticated) throw redirect({ to: "/login" });
  },
  loader: () => listAvailableTenants(),
  component: TenantSelectionRoute,
});
