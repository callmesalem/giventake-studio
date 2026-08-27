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

export type StoredConsent = {
  state: ConsentState;
  timestamp: number;
  version: 1;
};

const STORAGE_KEY = "gt.consent.v1";
const AUDIT_KEY = "gt.consent.audit.v1";
const AUDIT_LIMIT = 100;
const CONSENT_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 180 days

export const DEFAULT_STATE: ConsentState = {
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

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

export function readStored(): { stored: StoredConsent | null; expired: boolean } {
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

export function writeStored(state: ConsentState) {
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

export function diff(prev: ConsentState | null, next: ConsentState): ConsentCategory[] {
  const keys: ConsentCategory[] = ["necessary", "preferences", "analytics", "marketing"];
  if (!prev) return keys.filter((k) => next[k]);
  return keys.filter((k) => prev[k] !== next[k]);
}

export function appendAudit(entry: ConsentAuditEntry) {
  if (typeof window === "undefined") return;
  try {
    const log = readAuditLog();
    log.push(entry);
    window.localStorage.setItem(AUDIT_KEY, JSON.stringify(log.slice(-AUDIT_LIMIT)));
  } catch {
    /* storage blocked — nothing to do */
  }
}
