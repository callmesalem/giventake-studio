import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseCampaignStore } from "@/server/campaigns/supabase-store.ts";
import { verifyResendSignature } from "@/server/campaigns/webhook.ts";

/**
 * Resend delivery events. Only bounces and complaints matter: both are terminal
 * for an enrollment, and a complaint is the strongest possible signal to stop.
 *
 * The signature is verified before anything is read from the payload. An
 * unverified request is refused, never acted on — a forged bounce would kill a
 * live sequence silently.
 */
export const Route = createFileRoute("/api/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const secret = process.env.RESEND_WEBHOOK_SECRET;
        if (!url || !key || !secret) return new Response("unconfigured", { status: 503 });

        // Read the RAW body: the signature covers the exact bytes sent.
        const body = await request.text();
        const headers: Record<string, string> = {};
        request.headers.forEach((value, name) => {
          headers[name] = value;
        });

        if (!(await verifyResendSignature({ body, headers, secret }))) {
          return new Response("bad signature", { status: 401 });
        }

        const payload = (() => {
          try {
            return JSON.parse(body) as { type?: string; data?: { email_id?: string } };
          } catch {
            return null;
          }
        })();

        const type = payload?.type ?? "";
        const complained = type.includes("complained");
        if (!complained && !type.includes("bounced"))
          return new Response("ignored", { status: 200 });

        const messageId = payload?.data?.email_id;
        if (!messageId) return new Response("no id", { status: 200 });

        const store = createSupabaseCampaignStore({ url, serviceRoleKey: key });
        try {
          // Both land on the 'bounced' status because 'complained' is not one of
          // the statuses campaign_enrollments allows (20260818140000). The event
          // type keeps the two apart, which is the record that actually matters:
          // a spam complaint is a compliance fact, not a delivery failure.
          await store.markStatusByMessageId(
            messageId,
            "bounced",
            complained ? "complained" : "bounced",
            { type },
          );
        } catch {
          // 500 so Resend redelivers. Answering 200 on a failed write would drop
          // the bounce for good and leave the sequence mailing a dead address —
          // exactly the outcome this endpoint exists to prevent. The RPC is a
          // status write plus an append-only event, so a redelivery is safe.
          return new Response("retry", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
