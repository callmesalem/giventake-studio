import { createFileRoute } from "@tanstack/react-router";
import { verifyUnsubscribeToken } from "@/server/campaigns/tokens.ts";
import { createSupabaseCampaignStore } from "@/server/campaigns/supabase-store.ts";

const PAGE = (body: string) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });

/**
 * Unsubscribe. POST performs it; GET only offers a button.
 *
 * GET must never mutate. Mail clients and security scanners prefetch links, so
 * a mutating GET would silently unsubscribe recipients who never clicked.
 *
 * Both verbs answer 200 with the same shape regardless of whether the token was
 * valid: a different response for a bad token lets someone probe which are real.
 */
async function performUnsubscribe(token: string): Promise<void> {
  const secret = process.env.CAMPAIGN_TOKEN_SECRET;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !key) return;

  const enrollmentId = await verifyUnsubscribeToken(token, secret);
  if (!enrollmentId) return;

  const store = createSupabaseCampaignStore({ url, serviceRoleKey: key });
  await store
    .markStatus(enrollmentId, "unsubscribed", false, "unsubscribed", { via: "link" })
    .catch(() => undefined);
}

export const Route = createFileRoute("/api/unsubscribe/$token")({
  server: {
    handlers: {
      GET: ({ params }) =>
        PAGE(
          `<!doctype html><meta charset="utf-8"><title>Unsubscribe</title>` +
            `<p>Confirm you want to stop receiving these emails.</p>` +
            `<form method="post" action="/api/unsubscribe/${encodeURIComponent(params.token)}">` +
            `<button type="submit">Unsubscribe</button></form>`,
        ),

      POST: async ({ params }) => {
        await performUnsubscribe(params.token);
        return PAGE(
          `<!doctype html><meta charset="utf-8"><title>Unsubscribed</title>` +
            `<p>You have been unsubscribed.</p>`,
        );
      },
    },
  },
});
