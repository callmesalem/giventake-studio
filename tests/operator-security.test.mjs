import assert from "node:assert/strict";
import {
  assertDashboardAccess,
  dashboardConfigForClient,
} from "../src/server/operator-control/dashboard.ts";
import { SupabaseOperatorStore } from "../src/server/operator-control/supabase-store.ts";
const token = "A".repeat(48);
const env = { OPERATOR_DASHBOARD_ENABLED: "true", OPERATOR_DASHBOARD_ACCESS_TOKEN: token };
assert.throws(
  () => assertDashboardAccess({ host: "localhost" }, {}),
  (e) => e.status === 404,
);
assert.throws(
  () => assertDashboardAccess({ host: "example.com", remoteAddress: "127.0.0.1" }, env),
  (e) => e.status === 403,
);
assert.throws(
  () => assertDashboardAccess({ host: "localhost", remoteAddress: "203.0.113.9" }, env),
  (e) => e.status === 403,
);
assert.throws(
  () =>
    assertDashboardAccess({ host: "localhost", remoteAddress: "127.0.0.1", forwarded: true }, env),
  (e) => e.status === 403,
);
assert.throws(
  () => assertDashboardAccess({ host: "localhost", accessToken: "wrong" }, env),
  (e) => e.status === 403,
);
assert.deepEqual(dashboardConfigForClient({ host: "127.0.0.1", remoteAddress: "127.0.0.1" }, env), {
  localOnly: true,
  syntheticOnly: true,
  readOnly: true,
});
assert.throws(
  () =>
    assertDashboardAccess(
      {
        host: "localhost",
        remoteAddress: "127.0.0.1",
        mutation: true,
        origin: "https://evil.example",
      },
      env,
    ),
  (e) => e.status === 403,
);
assert.doesNotThrow(() =>
  assertDashboardAccess(
    {
      host: "localhost:3000",
      remoteAddress: "::1",
      mutation: true,
      origin: "http://localhost:3000",
    },
    env,
  ),
);
let captured;
const store = new SupabaseOperatorStore({
  url: "http://localhost:54321",
  serviceRoleKey: "server-secret",
  fetch: async (url, init) => {
    captured = { url, init };
    return new Response("false", { status: 200 });
  },
});
assert.equal(
  await store.approveSyntheticDraft("id", "b".repeat(64), "local:reviewer", "reviewed"),
  false,
);
assert.match(captured.url, /operator_approve/);
assert.doesNotMatch(captured.init.body, /browserActor/);
assert.doesNotMatch(
  JSON.stringify(await import("../src/server/operator-control/dashboard.ts")),
  /server-secret/,
);
const failing = new SupabaseOperatorStore({
  url: "http://localhost",
  serviceRoleKey: "x",
  fetch: async () => new Response("no", { status: 500 }),
});
await assert.rejects(() => failing.getControls("cro"), /RPC failed/);
console.log("operator security: ok");
