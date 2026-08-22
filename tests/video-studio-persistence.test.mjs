import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const { StudioConfigurationError, getStudioServerFor } = await vite.ssrLoadModule(
    "/src/lib/studio/server.ts",
  );

  const development = await getStudioServerFor({ NODE_ENV: "development" });
  assert.equal(development.kind, "memory");
  await assert.rejects(
    () => getStudioServerFor({ NODE_ENV: "production" }),
    (error) =>
      error instanceof StudioConfigurationError && error.code === "STUDIO_PERSISTENCE_UNAVAILABLE",
  );
  await assert.rejects(
    () =>
      getStudioServerFor({
        NODE_ENV: "production",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    (error) =>
      error instanceof StudioConfigurationError && error.code === "STUDIO_PERSISTENCE_UNAVAILABLE",
  );

  console.log("Video Studio persistence contracts passed.");
} finally {
  await vite.close();
}
