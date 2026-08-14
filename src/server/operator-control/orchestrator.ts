import type { OperatorStore, SyntheticInput } from "./types.ts";
import { audit } from "./audit.ts";
import { requireControls, PolicyDenied } from "./policy.ts";
export async function runSyntheticWorkflow(store: OperatorStore, input: SyntheticInput) {
  await requireControls(store, input.operator, "synthetic");
  if (!(await store.claimIdempotency(input.idempotencyKey)))
    throw new PolicyDenied("duplicate_idempotency");
  if (input.clientId && !(await store.clientAllowsAi(input.clientId)))
    throw new PolicyDenied("client_ai_restricted");
  if (await store.isSuppressed(input.lead.email)) throw new PolicyDenied("suppressed");
  const steps = ["lead_recorded", "compliance_passed", "draft_created", "approval_queued"];
  for (const type of steps)
    await audit(store, {
      type,
      operator: input.operator,
      runId: input.runId,
      details: {
        synthetic: true,
        email: input.lead.email,
        draft: type === "draft_created" ? input.draft : undefined,
      },
      at: new Date().toISOString(),
    });
  return { runId: input.runId, status: "awaiting_approval" as const, sideEffects: 0, steps };
}
