import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * GDPR / CCPA / ePrivacy compliant consent state.
 *
 * Categories follow the IAB TCF taxonomy:
 *   - necessary   : always on (site cannot function without it)
 *   - preferences : UI/state (theme, language) — opt-in
 *   - analytics   : GA4, product analytics — opt-in
 *   - marketing   : Meta / TikTok / LinkedIn pixels, retargeting — opt-in
 *
 * State is persisted for 6 months. After that the banner reappears
 * so users can renew or revoke consent (GDPR recommends max 12 months).
 *
 * Global Privacy Control: when the browser sends the GPC signal we treat it
 * as a legally binding opt-out of analytics and marketing, applied before any
 * tracker can boot, and we never silently re-enable those categories.
 *
 * Every state transition is written to a local, in-browser audit trail
 * (localStorage only, never sent anywhere) to make QA and support reproducible.
 */

export type ConsentCategory = "necessary" | "preferences" | "analytics" | "marketing";

export type ConsentState = Record<ConsentCategory, boolean>;

export type ConsentSource =
  | "accept-all"
  | "reject-all"
  | "save-preferences"
  | "restored"
  | "gpc"
  | "expired"
  | "default";

export type ConsentAuditEntry = {
  at: string;
  source: ConsentSource;
  state: ConsentState;
  changed: ConsentCategory[];
  gpc: boolean;
};

const STORAGE_KEY = "gt.consent.v1";
const AUDIT_KEY = "gt.consent.audit.v1";
const AUDIT_LIMIT = 100;
const CONSENT_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 180 days

const DEFAULT_STATE: ConsentState = {
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

type StoredConsent = {
  state: ConsentState;
  timestamp: number;
  version: 1;
};

type ConsentContextValue = {
  ready: boolean;
  decided: boolean;
  state: ConsentState;
  gpc: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  save: (next: Partial<ConsentState>) => void;
  openPreferences: () => void;
  preferencesOpen: boolean;
  closePreferences: () => void;
  auditLog: () => ConsentAuditEntry[];
  clearAuditLog: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

/** True when the browser signals Global Privacy Control. */
export function detectGpc(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl === true) return true;
  // Some browsers expose it via the DOM signal only.
  if (typeof window !== "undefined") {
    const w = window as Window & { globalPrivacyControl?: boolean };
    if (w.globalPrivacyControl === true) return true;
  }
  return false;
}

function readStored(): { stored: StoredConsent | null; expired: boolean } {
  if (typeof window === "undefined") return { stored: null, expired: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { stored: null, expired: false };
    const parsed = JSON.parse(raw) as StoredConsent;
    if (!parsed || parsed.version !== 1) return { stored: null, expired: false };
    if (Date.now() - parsed.timestamp > CONSENT_TTL_MS) return { stored: null, expired: true };
    return { stored: parsed, expired: false };
  } catch {
    return { stored: null, expired: false };
  }
}

function writeStored(state: ConsentState) {
  try {
    const payload: StoredConsent = { state, timestamp: Date.now(), version: 1 };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage blocked — nothing to do */
  }
}

export function readAuditLog(): ConsentAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ConsentAuditEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearAuditLog() {
  try {
    window.localStorage.removeItem(AUDIT_KEY);
  } catch {
    /* ignore */
  }
}

function diff(prev: ConsentState | null, next: ConsentState): ConsentCategory[] {
  const keys: ConsentCategory[] = ["necessary", "preferences", "analytics", "marketing"];
  if (!prev) return keys.filter((k) => next[k]);
  return keys.filter((k) => prev[k] !== next[k]);
}

function appendAudit(entry: ConsentAuditEntry) {
  if (typeof window === "undefined") return;
  try {
    const log = readAuditLog();
    log.push(entry);
    window.localStorage.setItem(AUDIT_KEY, JSON.stringify(log.slice(-AUDIT_LIMIT)));
  } catch {
    /* storage blocked — nothing to do */
  }
}

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

  const record = useCallback((next: ConsentState, source: ConsentSource, prev: ConsentState | null) => {
    appendAudit({
      at: new Date().toISOString(),
      source,
      state: next,
      changed: diff(prev, next),
      gpc: detectGpc(),
    });
  }, []);

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

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used inside <ConsentProvider>");
  return ctx;
}
