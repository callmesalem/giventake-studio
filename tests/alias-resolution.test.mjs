// The test harness's "@/" resolution, asserted rather than assumed.
//
// tsconfig maps "@/*" to "./src/*" and the bundler honours it, but node's ESM
// resolver treats "@/server" as a bare PACKAGE specifier and fails with
// ERR_MODULE_NOT_FOUND. That is why every server module a test could reach had
// to import by relative path, and why a module like src/server/approvals/deps.ts
// could not be loaded by a test AT ALL - not because of how it was written, but
// because of the loader.
//
// tests/helpers/alias-hook.mjs removes that constraint. This file is what proves
// the hook is installed: if the --import flag is ever dropped from the test
// script, this fails loudly right here, rather than surfacing later as a
// mysterious import error in whichever test next needs an aliased module.
import test from "node:test";
import assert from "node:assert/strict";

test("an @/ specifier resolves to the src module it names", async () => {
  const mod = await import("@/lib/approvals");
  assert.equal(typeof mod.canDecideApproval, "function");
});

test("a module that itself imports by @/ can now be loaded", async () => {
  // This is the case the hook exists for. deps.ts imports @/server/crm/read,
  // @/server/crm/actions and @/server/approvals/execute; before the hook it
  // threw "Cannot find package '@/server'" and no test could touch it.
  const mod = await import("@/server/approvals/deps");
  assert.equal(typeof mod.crmExecutorDeps, "function");
});

test("a real package specifier is still left to the default resolver", async () => {
  // The hook must intercept ONLY "@/". If it swallowed anything else, an
  // unresolvable package would surface as a confusing src-relative path instead
  // of an honest missing-package error.
  const mod = await import("node:path");
  assert.equal(typeof mod.resolve, "function");
});

test("an unresolvable @/ specifier still fails, and names what was asked for", async () => {
  // Failing closed matters: a hook that silently resolved a typo to something
  // else would turn a missing module into a wrong one.
  await assert.rejects(
    () => import("@/lib/this-module-does-not-exist"),
    (error) => {
      assert.match(String(error.message), /this-module-does-not-exist/);
      return true;
    },
  );
});
