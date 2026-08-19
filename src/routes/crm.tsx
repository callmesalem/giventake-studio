import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Inbox,
  Building2,
  Users,
  Handshake,
  ShieldCheck,
  UserCog,
  LogOut,
} from "lucide-react";
import { getCrmSession, logoutCrm } from "@/lib/crm-auth";
import type { CrmSession } from "@/server/crm/auth";

export const Route = createFileRoute("/crm")({
  beforeLoad: async ({ location }) => {
    const session = await getCrmSession();
    const onLogin = location.pathname === "/crm/login";
    if (!session && !onLogin) {
      throw redirect({ to: "/crm/login", search: { redirect: location.pathname } });
    }
    if (session && onLogin) {
      throw redirect({ to: "/crm" });
    }
    return { session };
  },
  component: CrmLayout,
});

const NAV = [
  { to: "/crm", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/crm/leads", label: "Leads", icon: Inbox, exact: false },
  { to: "/crm/companies", label: "Companies", icon: Building2, exact: false },
  { to: "/crm/contacts", label: "Contacts", icon: Users, exact: false },
  { to: "/crm/deals", label: "Deals", icon: Handshake, exact: false },
  { to: "/crm/approvals", label: "Approvals", icon: ShieldCheck, exact: false },
] as const;

function Sidebar({ session }: { session: CrmSession }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await logoutCrm();
      await router.invalidate();
      await router.navigate({ to: "/crm/login" });
    } finally {
      setBusy(false);
    }
  }

  const initials = session.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-5 py-5">
        <p className="text-sm font-semibold tracking-tight text-foreground">GivenTake CRM</p>
        <p className="text-xs text-muted-foreground">Team workspace</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
        {session.role === "admin" && (
          <Link
            to="/crm/team"
            activeOptions={{ exact: false }}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
          >
            <UserCog className="size-4" />
            Team
          </Link>
        )}
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{session.fullName}</p>
            <p className="truncate text-xs capitalize text-muted-foreground">{session.role}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={busy}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <LogOut className="size-4" />
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}

function CrmLayout() {
  const { session } = Route.useRouteContext();

  // Login page: rendered without the authenticated shell.
  if (!session) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar session={session} />
      <main className="flex-1 overflow-x-auto">
        <div className="mx-auto max-w-6xl p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
