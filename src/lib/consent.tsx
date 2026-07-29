import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
 */

export type ConsentCategory = "necessary" | "preferences" | "analytics" | "marketing";

export type ConsentState = Record<ConsentCategory, boolean>;

const STORAGE_KEY = "gt.consent.v1";
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
  acceptAll: () => void;
  rejectAll: () => void;
  save: (next: Partial<ConsentState>) => void;
  openPreferences: () => void;
  preferencesOpen: boolean;
  closePreferences: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

function readStored(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (!parsed || parsed.version !== 1) return null;
    if (Date.now() - parsed.timestamp > CONSENT_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
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

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [decided, setDecided] = useState(false);
  const [state, setState] = useState<ConsentState>(DEFAULT_STATE);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setState({ ...DEFAULT_STATE, ...stored.state, necessary: true });
      setDecided(true);
    }
    setReady(true);
  }, []);

  const commit = useCallback((next: ConsentState) => {
    const finalized = { ...next, necessary: true };
    setState(finalized);
    setDecided(true);
    writeStored(finalized);
    // Broadcast so tracking loaders can react.
    window.dispatchEvent(new CustomEvent("gt:consent-change", { detail: finalized }));
  }, []);

  const acceptAll = useCallback(() => {
    commit({ necessary: true, preferences: true, analytics: true, marketing: true });
    setPreferencesOpen(false);
  }, [commit]);

  const rejectAll = useCallback(() => {
    commit({ necessary: true, preferences: false, analytics: false, marketing: false });
    setPreferencesOpen(false);
  }, [commit]);

  const save = useCallback(
    (next: Partial<ConsentState>) => {
      commit({ ...state, ...next, necessary: true });
      setPreferencesOpen(false);
    },
    [commit, state],
  );

  const value = useMemo<ConsentContextValue>(
    () => ({
      ready,
      decided,
      state,
      acceptAll,
      rejectAll,
      save,
      openPreferences: () => setPreferencesOpen(true),
      closePreferences: () => setPreferencesOpen(false),
      preferencesOpen,
    }),
    [ready, decided, state, acceptAll, rejectAll, save, preferencesOpen],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used inside <ConsentProvider>");
  return ctx;
}
