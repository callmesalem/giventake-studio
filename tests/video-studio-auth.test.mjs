import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const {
    StudioAuthError,
    completeStudioAuthCallbackWith,
    getAuthenticatedStudioUserFrom,
    requestStudioMagicLinkForEmail,
  } = await vite.ssrLoadModule("/src/lib/studio/auth.ts");

  assert.equal(
    await getAuthenticatedStudioUserFrom(async () => ({ data: { user: null }, error: null })),
    null,
  );

  const sent = [];
  assert.deepEqual(
    await requestStudioMagicLinkForEmail(
      { email: "Operator@Example.Test" },
      {
        appUrl: "https://studio.example.test/",
        signInWithOtp: async (input) => sent.push(input),
      },
    ),
    { accepted: true },
  );
  assert.deepEqual(sent, [
    {
      email: "operator@example.test",
      options: { emailRedirectTo: "https://studio.example.test/studio/auth/callback" },
    },
  ]);
  assert.deepEqual(
    await requestStudioMagicLinkForEmail(
      { email: "missing@example.test" },
      {
        appUrl: "https://studio.example.test",
        signInWithOtp: async () => {
          throw new Error("provider failed");
        },
      },
    ),
    { accepted: true },
  );
  assert.deepEqual(
    await completeStudioAuthCallbackWith("code-12345678", {
      exchangeCode: async () => ({ user: { id: "operator-a", email: "operator@example.test" } }),
    }),
    { authenticated: true },
  );
  await assert.rejects(
    () => completeStudioAuthCallbackWith("bad", { exchangeCode: async () => ({ user: null }) }),
    (error) => error instanceof StudioAuthError && error.code === "AUTH_CALLBACK_INVALID",
  );

  console.log("Video Studio auth contracts passed.");
} finally {
  await vite.close();
}
