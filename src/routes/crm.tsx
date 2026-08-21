import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Inbox,
  Building2,
  Users,
  KanbanSquare,
  Handshake,
  CheckSquare,
  ShieldCheck,
  UserCog,
  LogOut,
  Menu,
  X,
  Loader2,
} from "lucide-react";
import { getCrmSession, logoutCrm } from "@/lib/crm-auth";
import type { CrmSession } from "@/server/crm/auth";

export const Route = createFileRoute("/crm")({
  beforeLoad: async ({ location }) => {
    const session = await getCrmSession();
    // Public paths within /crm: the login page and the OAuth start/callback routes.
    const isPublic =
      location.pathname === "/crm/login" || location.pathname.startsWith("/crm/auth/");
    if (!session && !isPublic) {
      throw redirect({ to: "/crm/login", search: { redirect: location.pathname } });
    }
    if (session && location.pathname === "/crm/login") {
      throw redirect({ to: "/crm" });
    }
    return { session };
  },
  component: CrmLayout,
  pendingComponent: CrmPending,
  errorComponent: CrmError,
});

const NAV = [
  { to: "/crm", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/crm/leads", label: "Leads", icon: Inbox, exact: false },
  { to: "/crm/companies", label: "Companies", icon: Building2, exact: false },
  { to: "/crm/contacts", label: "Contacts", icon: Users, exact: false },
  { to: "/crm/deals", label: "Deals", icon: Handshake, exact: false },
  { to: "/crm/pipeline", label: "Pipeline", icon: KanbanSquare, exact: false },
  { to: "/crm/tasks", label: "Tasks", icon: CheckSquare, exact: false },
  { to: "/crm/approvals", label: "Approvals", icon: ShieldCheck, exact: false },
] as const;

const navLinkClass =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground";

function SidebarContent({ session, onNavigate }: { session: CrmSession; onNavigate?: () => void }) {
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
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 py-5">
        <p className="text-sm font-semibold tracking-tight text-foreground">GivenTake CRM</p>
        <p className="text-xs text-muted-foreground">Team workspace</p>
      </div>
      <form
        role="search"
        className="px-3 pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("q");
          void router.navigate({ to: "/crm/search", search: { q: String(value ?? "") } });
        }}
      >
        <input
          name="q"
          type="search"
          placeholder="Search…"
          aria-label="Search the CRM"
          data-testid="crm-search-box"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
      </form>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            onClick={onNavigate}
            className={navLinkClass}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
        {session.role === "admin" && (
          <Link
            to="/crm/team"
            activeOptions={{ exact: false }}
            onClick={onNavigate}
            className={navLinkClass}
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
    </div>
  );
}

function CrmLayout() {
  const { session } = Route.useRouteContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Login page: rendered without the authenticated shell.
  if (!session) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent session={session} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <div>
          <p className="text-sm font-semibold text-foreground">GivenTake CRM</p>
        </div>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-border bg-card shadow-xl">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-5" />
            </button>
            <SidebarContent session={session} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-x-auto">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function CrmPending() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function CrmError({ error }: { error: Error }) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">This didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => void router.invalidate()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            to="/crm/login"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Sign in again
          </Link>
        </div>
      </div>
    </div>
  );
}
