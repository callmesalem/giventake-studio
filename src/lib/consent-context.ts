import { createContext } from "react";
import type { ConsentAuditEntry, ConsentState } from "./consent-core";

export type ConsentContextValue = {
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

export const ConsentContext = createContext<ConsentContextValue | null>(null);
