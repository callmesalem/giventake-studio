import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { addTeamMember, listTeamMembers } from "@/lib/crm-auth";
import { PageHeader, DataTable, Badge, Card } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/team")({
  beforeLoad: ({ context }) => {
    if (context.session?.role !== "admin") {
      throw redirect({ to: "/crm" });
    }
  },
  loader: () => listTeamMembers(),
  component: Team,
});

interface NewMember {
  email: string;
  tempPassword: string;
}

function Team() {
  const router = useRouter();
  const { members } = Route.useLoaderData();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<NewMember | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCreated(null);
    try {
      const result = await addTeamMember({ data: { email, fullName, role } });
      setCreated({ email: result.email, tempPassword: result.tempPassword });
      setEmail("");
      setFullName("");
      setRole("member");
      await router.invalidate();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not add member";
      setError(message.replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Team" subtitle="Add and manage who can access the CRM." />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <DataTable
            columns={["Name", "Email", "Role"]}
            rows={members.map((m) => [
              <span className="font-medium">{m.fullName}</span>,
              m.email,
              <Badge value={m.role} />,
            ])}
          />
        </div>

        <Card title="Add team member">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="m-name" className="text-sm font-medium text-foreground">
                Full name
              </label>
              <input
                id="m-name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="m-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="m-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="m-role" className="text-sm font-medium text-foreground">
                Role
              </label>
              <select
                id="m-role"
                value={role}
                onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "member")}
                disabled={busy}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="member">Member (read access)</option>
                <option value="admin">Admin (can manage team)</option>
              </select>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add member"}
            </button>
          </form>

          {created && (
            <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-900">Added {created.email}</p>
              <p className="mt-1 text-xs text-emerald-800">
                Share this one-time temporary password. It is shown once and is not stored. Ask them
                to change it after first sign-in.
              </p>
              <code className="mt-2 block break-all rounded bg-white px-2 py-1 font-mono text-sm text-emerald-950">
                {created.tempPassword}
              </code>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
