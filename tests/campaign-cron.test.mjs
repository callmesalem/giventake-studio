import test from "node:test";
import assert from "node:assert/strict";
import { runScheduledTick } from "../src/nitro/campaign-cron.ts";

/** Every required var, so a test can remove exactly one and see the guard fire. */
const fullConfig = () => ({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  RESEND_API_KEY: "re_test",
  INTAKE_FROM_EMAIL: "build@giventakedevs.com",
  CAMPAIGN_TOKEN_SECRET: "test-secret",
  CAMPAIGN_REPLY_TO: "reply@giventakedevs.com",
  CAMPAIGN_UNSUBSCRIBE_BASE: "https://giventakedevs.com/api/unsubscribe",
});

/** The tick logs rather than throws, so the log is the only observable outcome. */
const captureConsole = async (fn) => {
  const lines = [];
  const original = { warn: console.warn, log: console.log, error: console.error };
  for (const level of ["warn", "log", "error"]) {
    console[level] = (...args) => lines.push(args.join(" "));
  }
  try {
    await fn();
  } finally {
    Object.assign(console, original);
  }
  return lines.join("\n");
};

const spy = (impl) => {
  const calls = [];
  const run = async (deps) => {
    calls.push(deps);
    return impl ? impl(deps) : { sent: 0, skipped: 0 };
  };
  return { calls, run };
};

test("a missing secret sends nothing", async () => {
  const s = spy();
  const config = fullConfig();
  delete config.CAMPAIGN_TOKEN_SECRET;

  const logged = await captureConsole(() => runScheduledTick(config, { run: s.run }));

  assert.equal(s.calls.length, 0, "an unconfigured tick must not reach the runner");
  assert.match(logged, /CAMPAIGN_TOKEN_SECRET/, "the warning must name the missing var");
});

test("an empty string counts as missing", async () => {
  const s = spy();
  const logged = await captureConsole(() =>
    runScheduledTick({ ...fullConfig(), CAMPAIGN_UNSUBSCRIBE_BASE: "" }, { run: s.run }),
  );

  assert.equal(s.calls.length, 0);
  assert.match(logged, /CAMPAIGN_UNSUBSCRIBE_BASE/);
});

test("every missing var is named, not just the first", async () => {
  const config = fullConfig();
  delete config.RESEND_API_KEY;
  delete config.SUPABASE_URL;

  const logged = await captureConsole(() => runScheduledTick(config, { run: spy().run }));

  assert.match(logged, /SUPABASE_URL/);
  assert.match(logged, /RESEND_API_KEY/);
});

test("an unconfigured tick resolves rather than throwing", async () => {
  await captureConsole(() => runScheduledTick({}, { run: spy().run }));
});

test("a fully configured tick runs, and passes the values through", async () => {
  const s = spy(async () => ({ sent: 3, skipped: 1 }));

  const logged = await captureConsole(() => runScheduledTick(fullConfig(), { run: s.run }));

  assert.equal(s.calls.length, 1, "expected the runner to be called");
  const deps = s.calls[0];
  assert.equal(deps.secret, "test-secret");
  assert.equal(deps.replyTo, "reply@giventakedevs.com");
  assert.equal(deps.unsubscribeBase, "https://giventakedevs.com/api/unsubscribe");
  assert.ok(deps.store, "expected a store");
  assert.ok(deps.mailer, "expected a mailer");
  assert.match(logged, /sent=3 skipped=1/, "the outcome must be logged");
});

test("a throw from the runner does not propagate", async () => {
  const s = spy(async () => {
    throw new Error("supabase unreachable");
  });

  // Would reject if the throw escaped; a scheduled invocation has no caller.
  const logged = await captureConsole(() => runScheduledTick(fullConfig(), { run: s.run }));

  assert.equal(s.calls.length, 1);
  assert.match(logged, /supabase unreachable/, "the failure must still be logged");
});
