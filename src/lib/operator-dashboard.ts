import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, getRequestIP } from "@tanstack/react-start/server";
import { assertDashboardAccess } from "@/server/operator-control/dashboard";

function requestAccess(mutation: boolean) {
  const headers = getRequestHeaders();
  const cookieToken = (headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("operator_dashboard_access="))
    ?.slice("operator_dashboard_access=".length);
  const forwarded = [
    "forwarded",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-real-ip",
  ].some((name) => headers.has(name));
  return assertDashboardAccess({
    host: headers.get("host"),
    origin: headers.get("origin"),
    remoteAddress: getRequestIP({ xForwardedFor: false }),
    forwarded,
    accessToken: cookieToken ? decodeURIComponent(cookieToken) : null,
    mutation,
  });
}

export const requireLocalOperatorDashboard = createServerFn({ method: "GET" }).handler(() =>
  requestAccess(false),
);
const requireLocalOperatorMutation = () => requestAccess(true);

export interface LocalSyntheticRunInput {
  idempotencyKey: string;
  lead: {
    synthetic: true;
    fixtureKind: "local-synthetic";
    id: string;
    email: string;
    contactName: string;
    businessName: string;
    category: string;
    offerSlug: string;
    observedNeed: string;
  };
}

export const runLocalSyntheticLead = createServerFn({ method: "POST" })
  .validator((data: LocalSyntheticRunInput) => data)
  .handler(async ({ data }) => {
    const access = requireLocalOperatorMutation();
    if (!access.mutationsEnabled)
      throw new Response("Synthetic mutations disabled", { status: 403 });
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey)
      throw new Response("Operator database is not configured", { status: 503 });
    const [{ SupabaseOperatorStore }, { runPersistedSyntheticLeadWorkflow }] = await Promise.all([
      import("@/server/operator-control/supabase-store"),
      import("@/server/operator-control/synthetic-workflow"),
    ]);
    return runPersistedSyntheticLeadWorkflow(
      new SupabaseOperatorStore({ url, serviceRoleKey }),
      data,
    );
  });

export interface LocalDraftDecisionInput {
  approvalId: string;
  expectedPayloadHash: string;
  reason: string;
}

function validateDraftDecision(data: LocalDraftDecisionInput): LocalDraftDecisionInput {
  if (!data || typeof data.approvalId !== "string" || !data.approvalId.trim())
    throw new Response("Approval id required", { status: 400 });
  if (!/^[0-9a-f]{64}$/.test(data.expectedPayloadHash))
    throw new Response("Exact payload hash required", { status: 400 });
  if (typeof data.reason !== "string" || !data.reason.trim())
    throw new Response("Decision reason required", { status: 400 });
  return { ...data, reason: data.reason.trim() };
}

async function decideLocalSyntheticDraft(
  decision: "approve" | "reject",
  data: LocalDraftDecisionInput,
) {
  const access = requireLocalOperatorMutation();
  if (!access.mutationsEnabled) throw new Response("Synthetic mutations disabled", { status: 403 });
  const actor = process.env.OPERATOR_LOCAL_HUMAN_ACTOR;
  if (!actor || !/^local:[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(actor))
    throw new Response("Local human actor is not configured", { status: 503 });
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey)
    throw new Response("Operator database is not configured", { status: 503 });
  const { SupabaseOperatorStore } = await import("@/server/operator-control/supabase-store");
  const store = new SupabaseOperatorStore({ url, serviceRoleKey });
  const decided = await (decision === "approve"
    ? store.approveSyntheticDraft(data.approvalId, data.expectedPayloadHash, actor, data.reason)
    : store.rejectSyntheticDraft(data.approvalId, data.expectedPayloadHash, actor, data.reason));
  if (!decided) throw new Response("Approval is unavailable or changed", { status: 409 });
  return { decided: true } as const;
}

export const approveLocalSyntheticDraft = createServerFn({ method: "POST" })
  .validator(validateDraftDecision)
  .handler(({ data }) => decideLocalSyntheticDraft("approve", data));

export const rejectLocalSyntheticDraft = createServerFn({ method: "POST" })
  .validator(validateDraftDecision)
  .handler(({ data }) => decideLocalSyntheticDraft("reject", data));

export const getLocalOperatorDashboardSnapshot = createServerFn({ method: "GET" }).handler(
  async () => {
    const access = await requireLocalOperatorDashboard();
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey)
      throw new Response("Operator database is not configured", { status: 503 });

    // Dynamic server-side import keeps the service-role adapter and credential out
    // of the browser dependency graph.
    const { SupabaseOperatorStore } = await import("@/server/operator-control/supabase-store");
    const store = new SupabaseOperatorStore({ url, serviceRoleKey });
    return {
      ...access,
      snapshot: await store.getDashboardSnapshot(),
    };
  },
);
