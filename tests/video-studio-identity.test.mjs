import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const {
    StudioIdentityError,
    requireStudioIdentity,
    requireStudioIdentityFrom,
    requireStudioRole,
  } = await vite.ssrLoadModule("/src/lib/studio/identity.ts");

  assert.equal(typeof requireStudioIdentity, "function");

  const operator = { id: "operator-a", email: "operator@example.test" };
  const memberships = [
    { tenantId: "tenant-a", role: "operator" },
    { tenantId: "tenant-b", role: "viewer" },
  ];

  await assert.rejects(
    () => requireStudioIdentityFrom({ user: null, memberships }),
    (error) => error instanceof StudioIdentityError && error.code === "UNAUTHENTICATED",
  );
  await assert.rejects(
    () => requireStudioIdentityFrom({ user: operator, memberships, requestedTenantId: "tenant-c" }),
    (error) => error instanceof StudioIdentityError && error.code === "TENANT_FORBIDDEN",
  );

  const identity = await requireStudioIdentityFrom({
    user: operator,
    memberships,
    requestedTenantId: "tenant-a",
  });
  assert.deepEqual(identity, { tenantId: "tenant-a", actorId: "operator-a", role: "operator" });
  assert.doesNotThrow(() => requireStudioRole(identity, "operator"));
  assert.throws(
    () => requireStudioRole({ ...identity, role: "reviewer" }, "operator"),
    (error) => error instanceof StudioIdentityError && error.code === "ROLE_FORBIDDEN",
  );
  assert.doesNotThrow(() => requireStudioRole({ ...identity, role: "reviewer" }, "reviewer"));

  const original = {
    nodeEnv: process.env.NODE_ENV,
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  };
  process.env.NODE_ENV = "test";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  assert.deepEqual(await requireStudioIdentity(), {
    tenantId: "giventake-devs",
    actorId: "local-operator",
    role: "operator",
  });
  process.env.NODE_ENV = original.nodeEnv;
  if (original.url) process.env.SUPABASE_URL = original.url;
  if (original.anonKey) process.env.SUPABASE_ANON_KEY = original.anonKey;

  console.log("Video Studio identity contracts passed.");
} finally {
  await vite.close();
}
