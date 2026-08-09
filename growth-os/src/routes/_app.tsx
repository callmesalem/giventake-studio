import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { signOut } from "@/features/auth/auth.functions";
import { getBrand } from "@/features/branding/brand.functions";
import type { BrandInput } from "@/features/branding/brand.schemas";
import { endSupportSession, getSupportSessionStatus } from "@/features/tenants/support.functions";
import { getRouteSession } from "@/features/tenants/tenant-context.functions";

type AuthenticatedLayoutProps = {
  content?: ReactNode;
  brand?: BrandInput;
  supportSession?: { sessionId: string; expiresAt: string } | null;
  performSignOut?: () => Promise<{ signedOut: true }>;
  onSignedOut?: () => void;
  performEndSupport?: () => Promise<{ ended: true }>;
  onSupportEnded?: () => void;
};

const fallbackBrand: BrandInput = {
  displayName: "Growth OS",
  logoUrl: "https://giventakedevs.com/favicon.ico",
  primaryColor: "#0f766e",
  accentColor: "#f4b400",
  onPrimaryColor: "#ffffff",
  reportName: "Growth Report",
};

export function AuthenticatedLayout({
  content = <Outlet />,
  brand = fallbackBrand,
  supportSession = null,
  performSignOut = () => signOut(),
  onSignedOut = () => window.location.assign("/login"),
  performEndSupport = () => endSupportSession(),
  onSupportEnded = () => window.location.assign("/admin/support"),
}: AuthenticatedLayoutProps) {
  const [signingOut, setSigningOut] = useState(false);
  const [endingSupport, setEndingSupport] = useState(false);

  const brandVariables = {
    "--brand-primary": brand.primaryColor,
    "--brand-accent": brand.accentColor,
    "--brand-on-primary": brand.onPrimaryColor,
  } as CSSProperties;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await performSignOut();
      onSignedOut();
    } finally {
      setSigningOut(false);
    }
  }

  async function handleEndSupport() {
    setEndingSupport(true);
    try {
      await performEndSupport();
      onSupportEnded();
    } finally {
      setEndingSupport(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900"
      data-testid="authenticated-layout"
      style={brandVariables}
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-2">
          <a className="flex min-w-0 items-center gap-3 text-slate-950 no-underline" href="/">
            <img alt="" className="h-7 w-7 object-contain" src={brand.logoUrl} />
            <span className="truncate text-sm font-bold">{brand.displayName}</span>
          </a>
          <div className="flex items-center gap-2">
            <a
              className="rounded px-3 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-100"
              href="/settings"
            >
              Settings
            </a>
            {supportSession ? (
              <button
                className="inline-flex h-9 items-center gap-2 rounded border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:text-slate-400"
                disabled={endingSupport}
                onClick={handleEndSupport}
                title="End support session"
                type="button"
              >
                <ShieldOff aria-hidden="true" size={16} />
                End support
              </button>
            ) : null}
            <button
              className="rounded px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:text-slate-400"
              disabled={signingOut}
              onClick={handleSignOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6">{content}</main>
    </div>
  );
}

function AuthenticatedRoute() {
  const { brand, supportSession } = Route.useLoaderData();
  return <AuthenticatedLayout brand={brand} supportSession={supportSession} />;
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = await getRouteSession();
    if (!session.authenticated) throw redirect({ to: "/login" });
    if (!session.tenantSelected) throw redirect({ to: "/select-tenant" });
    return session;
  },
  loader: async () => {
    const [brand, supportSession] = await Promise.all([getBrand(), getSupportSessionStatus()]);
    return { brand, supportSession };
  },
  component: AuthenticatedRoute,
});
