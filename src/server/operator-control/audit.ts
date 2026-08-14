import type { AuditEvent, OperatorStore } from "./types.ts";
const SECRET = /token|secret|password|authorization|cookie|api.?key/i;
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET.test(k) ? "[REDACTED]" : redact(v),
      ]),
    );
  return value;
}
export async function audit(store: OperatorStore, event: AuditEvent) {
  try {
    await store.appendAudit({
      ...event,
      details: redact(event.details) as Record<string, unknown>,
    });
  } catch {
    throw new Error("audit_failed");
  }
}
