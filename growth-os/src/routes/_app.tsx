import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { signOut } from "@/features/auth/auth.functions";
import { getRouteSession } from "@/features/tenants/tenant-context.functions";

type AuthenticatedLayoutProps = {
  content?: ReactNode;
  performSignOut?: () => Promise<{ signedOut: true }>;
  onSignedOut?: () => void;
};

export function AuthenticatedLayout({
  content = <Outlet />,
  performSignOut = () => signOut(),
  onSignedOut = () => window.location.assign("/login"),
}: AuthenticatedLayoutProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await performSignOut();
      onSignedOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          <span className="text-sm font-bold text-slate-950">Growth OS</span>
          <button
            className="rounded px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:text-slate-400"
            disabled={signingOut}
            onClick={handleSignOut}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6">{content}</main>
    </div>
  );
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = await getRouteSession();
    if (!session.authenticated) throw redirect({ to: "/login" });
    if (!session.tenantSelected) throw redirect({ to: "/select-tenant" });
    return session;
  },
  component: AuthenticatedLayout,
});
