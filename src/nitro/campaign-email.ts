import { handleInboundEmail, type InboundMessage } from "../server/campaigns/inbound.ts";
import { createSupabaseCampaignStore } from "../server/campaigns/supabase-store.ts";

/**
 * Wires Cloudflare Email Routing to the reply handler.
 *
 * This has to be a nitro plugin, not an `email` export on src/server.ts. Nitro's
 * cloudflare-module preset builds the Worker's exported object itself
 * (createHandler in nitro/dist/presets/cloudflare/runtime/cloudflare-module.mjs)
 * and re-exports only that; extra properties on our default export are dropped
 * at build time, so an `email()` there is silently dead code. What the preset
 * DOES export is an `email(message, env, ctx)` that fires the `cloudflare:email`
 * nitro hook — which is this.
 *
 * Registered from vite.config.ts. Verify after any nitro upgrade with:
 *   npx vite build && grep -c "cloudflare:email" .output/server/index.mjs
 */
type EmailHookPayload = {
  message: InboundMessage;
  env?: Record<string, string | undefined>;
};

type NitroAppLike = {
  hooks: { hook(name: string, handler: (payload: EmailHookPayload) => unknown): unknown };
};

export default function campaignEmailPlugin(nitroApp: NitroAppLike) {
  nitroApp.hooks.hook("cloudflare:email", async ({ message, env }) => {
    // Worker bindings arrive on `env`; process.env is the nodejs_compat mirror
    // the rest of the app reads. Prefer the binding, fall back to the mirror.
    const read = (name: string) => env?.[name] ?? process.env[name];

    const url = read("SUPABASE_URL");
    const key = read("SUPABASE_SERVICE_ROLE_KEY");

    await handleInboundEmail({
      message,
      forwardTo: read("CAMPAIGN_FORWARD_TO"),
      store: url && key ? createSupabaseCampaignStore({ url, serviceRoleKey: key }) : undefined,
    });
  });
}
