import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { criticalCss } from "../lib/critical-css";

import { ConsentProvider } from "../lib/consent";
import { DeferredConsentBanner } from "../components/deferred-consent-banner";
import { BASE_URL, SITE_NAME, LEGAL_ENTITY } from "../lib/seo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "Px8gSZ1_p2Xkq7OUjUN6imyaIuCAMrOWU08OR2FvvrI" },
      { property: "og:type", content: "website" },
    ],
    links: [
      // Fetch the main sheet at high priority even though it is applied
      // non-blocking below (media="print" alone gets a low fetch priority).
      { rel: "preload", as: "style", href: appCss },
      // Loaded non-blocking: the inlined critical CSS paints the header and
      // hero, then this sheet is promoted to `all` right after first paint.
      { rel: "stylesheet", href: appCss, media: "print", "data-main-css": "" },

      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/fonts/inter-tight-latin.woff2",
        crossOrigin: "anonymous",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${BASE_URL}/#organization`,
              name: SITE_NAME,
              legalName: LEGAL_ENTITY,
              url: `${BASE_URL}/`,
              slogan: "Your On-Demand Development Team",
              description:
                "AI-native development studio building websites, apps, internal tools, and agentic workflows for small businesses and founders.",
            },
            {
              "@type": "WebSite",
              "@id": `${BASE_URL}/#website`,
              name: SITE_NAME,
              url: `${BASE_URL}/`,
              publisher: { "@id": `${BASE_URL}/#organization` },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var d=document.documentElement;var s=function(){var l=document.querySelectorAll('link[data-main-css]');for(var i=0;i<l.length;i++){l[i].media='all'}var m=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(!m){d.setAttribute('data-motion','on')}};if(window.requestAnimationFrame){requestAnimationFrame(function(){requestAnimationFrame(s)})}else{s()}})();",
          }}
        />

        <noscript>
          <link rel="stylesheet" href={appCss} />
        </noscript>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ConsentProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <DeferredConsentBanner />
      </ConsentProvider>
    </QueryClientProvider>
  );
}
