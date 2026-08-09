import { createFileRoute, redirect } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { getSupportAdminData, startSupportSession } from "@/features/tenants/support.functions";
import { getRouteSession } from "@/features/tenants/tenant-context.functions";

type SupportTenant = { id: string; displayName: string };

type SupportSessionFormProps = {
  tenants: SupportTenant[];
  beginSupport?: (input: {
    tenantId: string;
    reason: string;
    durationMinutes: number;
  }) => Promise<{ sessionId: string; expiresAt: string }>;
  onStarted?: () => void;
};

export function SupportSessionForm({
  tenants,
  beginSupport = (input) => startSupportSession({ data: input }),
  onStarted = () => window.location.assign("/"),
}: SupportSessionFormProps) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [status, setStatus] = useState<"idle" | "starting" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("starting");
    try {
      await beginSupport({ tenantId, reason, durationMinutes });
      onStarted();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="grid max-w-xl gap-5" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm font-semibold text-slate-800">
        Tenant
        <select
          className="h-10 rounded border border-slate-300 bg-white px-3 font-normal text-slate-950"
          onChange={(event) => setTenantId(event.target.value)}
          required
          value={tenantId}
        >
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-800">
        Support reason
        <textarea
          className="min-h-28 resize-y rounded border border-slate-300 bg-white px-3 py-2 font-normal leading-6 text-slate-950"
          maxLength={500}
          minLength={10}
          onChange={(event) => setReason(event.target.value)}
          required
          value={reason}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-800">
        Duration
        <select
          className="h-10 rounded border border-slate-300 bg-white px-3 font-normal text-slate-950"
          onChange={(event) => setDurationMinutes(Number(event.target.value))}
          value={durationMinutes}
        >
          {[15, 30, 45, 60].map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-4 border-t border-slate-200 pt-5">
        <button
          className="inline-flex h-10 items-center gap-2 rounded bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-400"
          disabled={status === "starting" || tenants.length === 0}
          type="submit"
        >
          <ShieldCheck aria-hidden="true" size={16} />
          Start support
        </button>
        {status === "error" ? (
          <p className="m-0 text-sm text-red-700" role="alert">
            Support access could not be started.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function SupportAdminRoute() {
  const { tenants } = Route.useLoaderData();
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900">
      <section className="mx-auto max-w-3xl border-t border-slate-300 pt-7">
        <p className="mb-2 text-sm font-bold uppercase text-teal-700">Growth OS Admin</p>
        <h1 className="mb-7 text-2xl font-bold text-slate-950">Support access</h1>
        <SupportSessionForm tenants={tenants} />
      </section>
    </main>
  );
}

export const Route = createFileRoute("/admin/support")({
  beforeLoad: async () => {
    const session = await getRouteSession();
    if (!session.authenticated) throw redirect({ to: "/login" });
  },
  loader: () => getSupportAdminData(),
  component: SupportAdminRoute,
});
