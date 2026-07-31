import { lazy, Suspense, useEffect, useState } from "react";

const ConsentBanner = lazy(() =>
  import("@/components/consent-banner").then((m) => ({ default: m.ConsentBanner })),
);

/**
 * The banner is a fixed overlay that pulls in Radix Dialog, the checkbox
 * primitive and the tracking loader. None of that is needed to paint the page,
 * and no tracker can run before a choice is made anyway, so we keep it out of
 * the critical bundle and mount it once the browser is idle after first paint.
 *
 * Rendering nothing on the server (and on the first client frame) keeps
 * hydration in sync; the banner appears a tick later, still long before any
 * script could set a cookie.
 */
export function DeferredConsentBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idle = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;

    if (idle) {
      const id = idle(() => setReady(true), { timeout: 2000 });
      return () => (window as unknown as { cancelIdleCallback?: (id: number) => void })
        .cancelIdleCallback?.(id);
    }

    const t = window.setTimeout(() => setReady(true), 200);
    return () => window.clearTimeout(t);
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <ConsentBanner />
    </Suspense>
  );
}
