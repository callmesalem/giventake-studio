import type {
  Approval,
  ControlState,
  OperatorAction,
  OperatorMode,
  OperatorStore,
} from "./types.ts";
import { payloadHash } from "./hash.ts";
export const HARD_DENIED = new Set<OperatorAction>([
  "send",
  "deploy",
  "set_price",
  "change_scope",
  "sign",
  "refund",
]);
export class PolicyDenied extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "PolicyDenied";
  }
}
export function enforceAction(action: OperatorAction) {
  if (HARD_DENIED.has(action)) throw new PolicyDenied("hard_prohibition");
}
export async function requireControls(
  store: OperatorStore,
  operator: string,
  mode: OperatorMode,
): Promise<ControlState> {
  let c: ControlState | null;
  try {
    c = await store.getControls(operator);
  } catch {
    throw new PolicyDenied("control_unavailable");
  }
  if (!c) throw new PolicyDenied("control_missing");
  if (!c.globalEnabled) throw new PolicyDenied("global_kill_switch");
  if (!c.enabled) throw new PolicyDenied("control_disabled");
  if (!c.allowedModes.includes(mode)) throw new PolicyDenied("mode_disabled");
  return c;
}
export function validateApproval(
  a: Approval | null,
  action: OperatorAction,
  payload: unknown,
  now = new Date(),
): Approval {
  enforceAction(action);
  if (!a) throw new PolicyDenied("approval_missing");
  if (a.action !== action || a.payloadHash !== payloadHash(payload))
    throw new PolicyDenied("approval_payload_mismatch");
  if (a.revokedAt) throw new PolicyDenied("approval_revoked");
  if (a.consumedAt) throw new PolicyDenied("approval_consumed");
  if (new Date(a.expiresAt) <= now) throw new PolicyDenied("approval_expired");
  return a;
}
export async function consumeApproval(
  store: OperatorStore,
  id: string,
  action: OperatorAction,
  payload: unknown,
  now = new Date(),
) {
  const a = validateApproval(await store.getApproval(id), action, payload, now);
  if (!(await store.consumeApproval(a.id, a.payloadHash, now.toISOString())))
    throw new PolicyDenied("approval_consumed");
  return a;
}
