import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const { StudioWorkerConfigurationError, buildProductionRenderJob, readStudioWorkerConfig } =
    await vite.ssrLoadModule("/src/lib/studio/render-request.ts");

  const job = buildProductionRenderJob({
    job: {
      id: "11111111-1111-1111-1111-111111111111",
      tenantId: "tenant-a",
      campaignId: "22222222-2222-2222-2222-222222222222",
      revisionId: "33333333-3333-3333-3333-333333333333",
      provider: "fixture",
      model: "fixture",
      requestedBudgetCents: 2500,
      reservedCents: 0,
      idempotencyKey: "44444444-4444-4444-4444-444444444444",
      workerJobId: null,
      status: "queued",
      failureCode: null,
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    },
    campaign: {
      id: "22222222-2222-2222-2222-222222222222",
      tenantId: "tenant-a",
      name: "Launch campaign",
      goal: "Create qualified inquiries",
      offer: "Agentic development",
      audience: "Owners",
      callToAction: "Book a call",
      budgetCents: 2500,
      status: "rendering",
      currentRevisionId: "33333333-3333-3333-3333-333333333333",
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    },
    revision: {
      id: "33333333-3333-3333-3333-333333333333",
      tenantId: "tenant-a",
      campaignId: "22222222-2222-2222-2222-222222222222",
      number: 1,
      brief: {
        tenantId: "tenant-a",
        name: "Launch campaign",
        goal: "Create qualified inquiries",
        offer: "Agentic development",
        audience: "Owners",
        callToAction: "Book a call",
        budgetCents: 2500,
      },
      storyboard: [
        {
          order: 1,
          durationSeconds: 5,
          purpose: "hook",
          narration: "Create qualified inquiries",
          prompt: "Premium cinematic opening",
          safeArea: "bottom",
        },
      ],
      createdAt: "2026-08-21T00:00:00.000Z",
      createdBy: "operator-a",
    },
    brand: {
      id: "55555555-5555-5555-5555-555555555555",
      tenantId: "tenant-a",
      name: "GivenTake Devs",
      website: "https://giventakedevs.com",
      callToAction: "Book a call",
      primaryColor: "#112548",
      accentColor: "#CFAE64",
      createdAt: "2026-08-21T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
    },
  });
  assert.equal(job.brand.name, "GivenTake Devs");
  assert.equal(job.storyboard.length, 1);
  assert.equal(job.budgetCents, 2500);
  assert.deepEqual(
    readStudioWorkerConfig({
      STUDIO_WORKER_URL: "http://127.0.0.1:8788",
      STUDIO_WORKER_SHARED_SECRET: "a".repeat(64),
    }),
    { baseUrl: "http://127.0.0.1:8788", sharedSecret: "a".repeat(64) },
  );
  assert.throws(
    () => readStudioWorkerConfig({ STUDIO_WORKER_URL: "https://worker.example.test" }),
    (error) =>
      error instanceof StudioWorkerConfigurationError &&
      error.code === "STUDIO_WORKER_CONFIGURATION_INVALID",
  );

  console.log("Video Studio render request contracts passed.");
} finally {
  await vite.close();
}
