/**
 * Public proposal endpoints. No session: possession of the link code is the
 * credential. Only the code's sha-256 is stored, and the RPCs return
 * client-facing fields only. Nothing here may require a CRM session.
 */
import { createServerFn } from "@tanstack/react-start";
import type { DocLine } from "@/components/proposal-document";

export interface PublicProposal {
  id: string;
  title: string;
  summary: string;
  timeline: string;
  valid_until: string | null;
  state: "open" | "accepted" | "declined" | "expired" | "superseded";
  accepted_option: string | null;
  client: string | null;
  lines: DocLine[];
}

/** sendProposal issues 32 random bytes as base64url: 43 characters. */
const CODE = /^[A-Za-z0-9_-]{43}$/;

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("This page is temporarily unavailable.");
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    // Surface only the RPC's own refusal text (raise exception ...), never internals.
    const detail = await response.text().catch(() => "");
    const message = /"message"\s*:\s*"([^"]{1,200})"/.exec(detail)?.[1];
    throw new Error(message ?? "That didn't go through. Please try again.");
  }
  return (await response.json()) as T;
}

async function hash(code: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(code).digest("hex");
}

export const viewProposal = createServerFn({ method: "GET" })
  .validator((d: { code: string }) => ({ code: String(d?.code ?? "") }))
  .handler(async ({ data }): Promise<PublicProposal | null> => {
    if (!CODE.test(data.code)) return null;
    const h = await hash(data.code);
    const p = await rpc<PublicProposal | null>("proposal_public", { p_token_hash: h });
    if (p && p.state === "open") {
      await rpc("proposal_mark_viewed", { p_token_hash: h }).catch(() => undefined);
    }
    return p;
  });

export const decideProposal = createServerFn({ method: "POST" })
  .validator((d: Record<string, unknown>) => ({
    code: String(d?.code ?? ""),
    decision: d?.decision === "decline" ? ("decline" as const) : ("accept" as const),
    option: String(d?.option ?? ""),
    name: String(d?.name ?? "").slice(0, 200),
    reason: String(d?.reason ?? "").slice(0, 500),
    consent: d?.consent === true,
  }))
  .handler(async ({ data }): Promise<{ status: string }> => {
    if (!CODE.test(data.code)) throw new Error("This proposal link isn't valid.");
    if (data.decision === "accept" && !data.consent) {
      throw new Error("Tick the box to accept the proposal.");
    }
    const h = await hash(data.code);
    const result = await rpc<{ status: string }>("proposal_decide", {
      p_token_hash: h,
      p_decision: data.decision,
      p_option: data.option,
      p_name: data.name,
      p_reason: data.reason,
    });
    if (result.status === "accepted" || result.status === "declined") {
      await notifyOwner(h, result.status, data).catch(() => undefined);
    }
    return result;
  });

async function notifyOwner(
  tokenHash: string,
  status: string,
  data: { option: string; name: string; reason: string },
): Promise<void> {
  const p = await rpc<PublicProposal | null>("proposal_public", { p_token_hash: tokenHash });
  const { sendMail } = await import("@/lib/intake");
  const to = process.env.INTAKE_TO_EMAIL ?? "build@giventakedevs.com";
  const body =
    status === "accepted"
      ? `${p?.client ?? "A client"} accepted "${p?.title ?? "a proposal"}".\nPayment option: ${data.option}. Accepted by: ${data.name}.\nA task to send the SOW is on the Tasks page.`
      : `${p?.client ?? "A client"} declined "${p?.title ?? "a proposal"}".\nReason: ${data.reason || "(none given)"}`;
  await sendMail(to, `Proposal ${status}: ${p?.title ?? "proposal"}`, body, to);
}
