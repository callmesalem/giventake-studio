import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createViteServer } from "vite";

const tempDirectory = mkdtempSync(join(tmpdir(), "giventake-video-worker-"));
const vite = await createViteServer({ logLevel: "silent", server: { middlewareMode: true } });
let repository;
let killSwitchRepository;

try {
  const { createWorkerRepository } = await import("../services/video-worker/src/repository.mjs");
  const { createWorkerHttpServer } = await import("../services/video-worker/src/http-server.mjs");
  const { createProductionWorkerClient } = await vite.ssrLoadModule(
    "/src/lib/studio/production-worker-client.ts",
  );
  const now = new Date("2026-08-21T12:00:00.000Z");
  repository = createWorkerRepository({ databasePath: join(tempDirectory, "worker.db") });
  const server = createWorkerHttpServer({
    repository,
    config: { sharedSecret: "worker-secret", outboundKillSwitch: false, maxBodyBytes: 100_000 },
    now: () => now,
  });
  const address = await server.listen();
  const client = createProductionWorkerClient({
    baseUrl: address.url,
    sharedSecret: "worker-secret",
    now: () => now,
    requestId: () => "request-0001",
  });
  const job = {
    id: "job-0001",
    tenantId: "giventake-devs",
    campaignId: "campaign-0001",
    revisionId: "revision-0001",
    provider: "fixture",
    model: "fixture",
    budgetCents: 500,
    brand: { name: "GivenTake Devs", website: "giventakedevs.com", callToAction: "Book" },
    storyboard: [
      {
        order: 1,
        durationSeconds: 5,
        purpose: "hook",
        narration: "A clear opening",
        prompt: "Cinematic business opening",
        safeArea: "bottom",
      },
    ],
  };

  assert.deepEqual(await client.enqueue(job), { id: job.id, status: "queued" });
  await assert.rejects(() => client.enqueue(job), /409/);
  assert.deepEqual(await client.getStatus({ tenantId: job.tenantId, jobId: job.id }), {
    id: job.id,
    status: "queued",
  });

  const killSwitchServer = createWorkerHttpServer({
    repository: (killSwitchRepository = createWorkerRepository({
      databasePath: join(tempDirectory, "kill-switch.db"),
    })),
    config: { sharedSecret: "worker-secret", outboundKillSwitch: true, maxBodyBytes: 100_000 },
    now: () => now,
  });
  const killSwitchAddress = await killSwitchServer.listen();
  const blockedClient = createProductionWorkerClient({
    baseUrl: killSwitchAddress.url,
    sharedSecret: "worker-secret",
    now: () => now,
    requestId: () => "request-0002",
  });
  await assert.rejects(() => blockedClient.enqueue(job), /503/);

  await killSwitchServer.close();
  await server.close();
  console.log("Video worker HTTP tests passed.");
} finally {
  await vite.close();
  repository?.close();
  killSwitchRepository?.close();
  rmSync(tempDirectory, { recursive: true, force: true });
}
