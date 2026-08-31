import { runSendTick, type RunnerDeps } from "../server/campaigns/runner.ts";
import { createResendMailer } from "../server/campaigns/mailer.ts";
import { createSupabaseCampaignStore } from "../server/campaigns/supabase-store.ts";

/**
 * Fires the campaign send tick on Cloudflare's cron trigger. This is the commit
 * that makes the engine capable of sending: every stop condition it relies on
 * (reply, unsubscribe, bounce, suppression, max-attempts) already exists.
 *
 * This has to be a nitro plugin, not a `scheduled` export on src/server.ts.
 * Nitro's cloudflare-module preset builds the Worker's exported object itself
 * (createHandler in nitro/dist/presets/cloudflare/runtime/_module-handler.mjs)
 * and re-exports only that; extra properties on our default export are dropped
 * at build time, so a `scheduled()` there is silently dead code. What the preset
 * DOES export is a `scheduled(controller, env, ctx)` that fires the
 * `cloudflare:scheduled` nitro hook — which is this.
 *
 * Registered from vite.config.ts; the schedule itself is wrangler.jsonc's
 * `triggers.crons`. Both halves are required — a plugin with no cron never
 * fires, and a cron with no plugin fires into nothing. Verify after any nitro
 * upgrade with:
 *   npx vite build && grep -c "cloudflare:scheduled" .output/server/index.mjs
 */

/**
 * Everything the tick cannot run without. Kept as one list so the guard below
 * and the hook that gathers the values cannot drift apart.
 */
const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "INTAKE_FROM_EMAIL",
  "CAMPAIGN_TOKEN_SECRET",
  "CAMPAIGN_REPLY_TO",
  "CAMPAIGN_UNSUBSCRIBE_BASE",
] as const;

type ConfigKey = (typeof REQUIRED)[number];

export type TickConfig = Partial<Record<ConfigKey, string | undefined>>;

export interface TickOverrides {
  /** Seam for tests. Production always uses runSendTick. */
  run?: (deps: RunnerDeps) => Promise<{ sent: number; skipped: number }>;
}

/**
 * The hook body, exported so it is testable without standing up a nitro app.
 *
 * Never throws. A scheduled invocation has no caller to return an error to, so
 * the only useful thing an error can do here is appear in the Worker log.
 */
export async function runScheduledTick(
  config: TickConfig,
  overrides: TickOverrides = {},
): Promise<void> {
  // A partial configuration must be a clean no-op, not a partial send. Missing
  // CAMPAIGN_TOKEN_SECRET alone would make runSendTick throw, but the others
  // fail worse and quieter: an unset CAMPAIGN_UNSUBSCRIBE_BASE would put
  // "undefined/<token>" in the one link every recipient is legally entitled to
  // use. Refuse the whole tick and name what is missing — var names are not
  // secrets, and without them a silent cron is undiagnosable.
  const missing = REQUIRED.filter((name) => !config[name]);
  if (missing.length > 0) {
    console.warn(`campaign cron: not configured, skipping. Unset: ${missing.join(", ")}`);
    return;
  }

  // Unreachable fallback: the guard above already rejected every empty value.
  const value = (name: ConfigKey): string => config[name] ?? "";

  const run = overrides.run ?? runSendTick;

  try {
    // Neither factory performs I/O when constructed, so building them after the
    // guard costs nothing and keeps the unconfigured path free of side effects.
    const result = await run({
      store: createSupabaseCampaignStore({
        url: value("SUPABASE_URL"),
        serviceRoleKey: value("SUPABASE_SERVICE_ROLE_KEY"),
      }),
      mailer: createResendMailer({
        apiKey: value("RESEND_API_KEY"),
        from: value("INTAKE_FROM_EMAIL"),
      }),
      replyTo: value("CAMPAIGN_REPLY_TO"),
      unsubscribeBase: value("CAMPAIGN_UNSUBSCRIBE_BASE"),
      secret: value("CAMPAIGN_TOKEN_SECRET"),
    });
    // Counts only — no address, subject or body reaches the log.
    console.log(`campaign cron: sent=${result.sent} skipped=${result.skipped}`);
  } catch (error) {
    // Swallowed on purpose, but never silently. Rethrowing would surface as an
    // unhandled rejection inside the preset's waitUntil, which reaches nobody.
    // Nothing is lost by giving up here: an unfinished step stays re-claimable,
    // so the next tick retries it.
    console.error("campaign cron failed:", error instanceof Error ? error.message : "unknown");
  }
}

type ScheduledHookPayload = {
  env?: Record<string, string | undefined>;
};

type NitroAppLike = {
  hooks: { hook(name: string, handler: (payload: ScheduledHookPayload) => unknown): unknown };
};

export default function campaignCronPlugin(nitroApp: NitroAppLike) {
  nitroApp.hooks.hook("cloudflare:scheduled", async ({ env }) => {
    // Worker bindings arrive on `env`; process.env is the nodejs_compat mirror
    // the rest of the app reads. Prefer the binding, fall back to the mirror.
    const read = (name: string) => env?.[name] ?? process.env[name];

    const config: TickConfig = {};
    for (const name of REQUIRED) config[name] = read(name);

    await runScheduledTick(config);
  });
}
