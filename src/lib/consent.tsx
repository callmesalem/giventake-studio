import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ConsentContext, type ConsentContextValue } from "./consent-context";
import {
  appendAudit,
  clearAuditLog,
  DEFAULT_STATE,
  detectGpc,
  diff,
  readAuditLog,
  readStored,
  writeStored,
  type ConsentSource,
  type ConsentState,
} from "./consent-core";
import { initTracking } from "./tracking";

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [decided, setDecided] = useState(false);
  const [state, setState] = useState<ConsentState>(DEFAULT_STATE);
  const [gpc, setGpc] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  // The exact element that opened the preferences dialog, so focus can be
  // returned to it verbatim on close (banner button, footer link, or CTA).
  const triggerRef = useRef<HTMLElement | null>(null);
  // Stable key for triggers that unmount while the dialog is open (the banner
  // hides itself), so focus can be restored to the re-rendered instance.
  const triggerKeyRef = useRef<string | null>(null);
  const stateRef = useRef<ConsentState>(DEFAULT_STATE);
  stateRef.current = state;

  const record = useCallback(
    (next: ConsentState, source: ConsentSource, prev: ConsentState | null) => {
      appendAudit({
        at: new Date().toISOString(),
        source,
        state: next,
        changed: diff(prev, next),
        gpc: detectGpc(),
      });
    },
    [],
  );

  useEffect(() => {
    const signal = detectGpc();
    setGpc(signal);

    const { stored, expired } = readStored();
    let next: ConsentState = DEFAULT_STATE;
    let source: ConsentSource = expired ? "expired" : "default";
    let isDecided = false;

    if (stored) {
      next = { ...DEFAULT_STATE, ...stored.state, necessary: true };
      source = "restored";
      isDecided = true;
    }

    if (signal) {
      // GPC is a binding opt-out: force analytics/marketing off regardless of
      // what was previously stored, and treat the choice as already made.
      const forced: ConsentState = { ...next, analytics: false, marketing: false };
      const changed = diff(next, forced).length > 0;
      next = forced;
      isDecided = true;
      if (changed || !stored) source = "gpc";
      writeStored(next);
    }

    setState(next);
    setDecided(isDecided);
    record(next, source, stored ? { ...DEFAULT_STATE, ...stored.state, necessary: true } : null);
    setReady(true);
  }, [record]);

  // Switch the consent-gated tracking loaders on exactly once, after the
  // stored (or default) consent has been restored. initTracking applies the
  // current state on start and reacts to every later change through the
  // "gt:consent-change" broadcast, so nothing loads before consent exists.
  // The `initialized` guard inside initTracking makes this StrictMode-safe.
  useEffect(() => {
    if (!ready) return;
    initTracking(() => stateRef.current);
  }, [ready]);

  const commit = useCallback(
    (next: ConsentState, source: ConsentSource) => {
      const signal = detectGpc();
      const finalized: ConsentState = {
        ...next,
        necessary: true,
        // A GPC signal cannot be overridden by an "accept all" click.
        analytics: signal ? false : next.analytics,
        marketing: signal ? false : next.marketing,
      };
      const prev = stateRef.current;
      setState(finalized);
      setDecided(true);
      writeStored(finalized);
      record(finalized, signal && source === "accept-all" ? "gpc" : source, prev);
      // Broadcast so tracking loaders can react.
      window.dispatchEvent(new CustomEvent("gt:consent-change", { detail: finalized }));
    },
    [record],
  );

  const restoreFocus = useCallback(() => {
    const el = triggerRef.current;
    const key = triggerKeyRef.current;
    triggerRef.current = null;
    triggerKeyRef.current = null;
    if (!el && !key) return;
    // Wait for the dialog to unmount (and Radix to settle) before moving focus back.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (el && el.isConnected) {
          el.focus({ preventScroll: true });
          return;
        }
        // The trigger unmounted or re-rendered: find the same control by key,
        // then fall back to the persistent cookie-settings button so focus
        // never lands on <body>.
        const byKey = key
          ? document.querySelector<HTMLElement>(`[data-consent-trigger="${key}"]`)
          : null;
        const fallback =
          byKey ?? document.querySelector<HTMLElement>('[data-consent-trigger="persistent"]');
        fallback?.focus({ preventScroll: true });
      });
    });
  }, []);

  const acceptAll = useCallback(() => {
    commit({ necessary: true, preferences: true, analytics: true, marketing: true }, "accept-all");
    setPreferencesOpen(false);
    restoreFocus();
  }, [commit, restoreFocus]);

  const rejectAll = useCallback(() => {
    commit(
      { necessary: true, preferences: false, analytics: false, marketing: false },
      "reject-all",
    );
    setPreferencesOpen(false);
    restoreFocus();
  }, [commit, restoreFocus]);

  const save = useCallback(
    (next: Partial<ConsentState>) => {
      commit({ ...stateRef.current, ...next, necessary: true }, "save-preferences");
      setPreferencesOpen(false);
      restoreFocus();
    },
    [commit, restoreFocus],
  );

  const openPreferences = useCallback(() => {
    const active = typeof document !== "undefined" ? document.activeElement : null;
    const el = active instanceof HTMLElement ? active : null;
    triggerRef.current = el;
    triggerKeyRef.current = el?.getAttribute("data-consent-trigger") ?? null;
    setPreferencesOpen(true);
  }, []);

  const closePreferences = useCallback(() => {
    setPreferencesOpen(false);
    restoreFocus();
  }, [restoreFocus]);

  const value = useMemo<ConsentContextValue>(
    () => ({
      ready,
      decided,
      state,
      gpc,
      acceptAll,
      rejectAll,
      save,
      openPreferences,
      closePreferences,
      preferencesOpen,
      auditLog: readAuditLog,
      clearAuditLog,
    }),
    [
      ready,
      decided,
      state,
      gpc,
      acceptAll,
      rejectAll,
      save,
      openPreferences,
      closePreferences,
      preferencesOpen,
    ],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}
