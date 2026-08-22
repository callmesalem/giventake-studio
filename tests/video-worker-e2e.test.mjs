import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirectory = mkdtempSync(join(tmpdir(), "giventake-video-worker-"));
let repository;

try {
  const { createWorkerRepository } = await import("../services/video-worker/src/repository.mjs");
  const { createFixtureProvider } = await import("../services/video-worker/src/providers.mjs");
  const { createScheduler } = await import("../services/video-worker/src/scheduler.mjs");
  const { createPostProductionProcessor } =
    await import("../services/video-worker/src/post-production-processor.mjs");
  repository = createWorkerRepository({ databasePath: join(tempDirectory, "worker.db") });
  const now = new Date("2026-08-21T12:00:00.000Z");
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
      {
        order: 2,
        durationSeconds: 10,
        purpose: "proof",
        narration: "A useful proof point",
        prompt: "Cinematic business proof",
        safeArea: "bottom",
      },
      {
        order: 3,
        durationSeconds: 5,
        purpose: "cta",
        narration: "Book a discovery call",
        prompt: "Cinematic business close",
        safeArea: "center",
      },
    ],
  };
  repository.enqueue(job, "request-0001", now);
  const scheduler = createScheduler({
    repository,
    providers: { fixture: createFixtureProvider() },
    rates: { fixture: { fixture: 0 } },
    now: () => now,
    leaseMs: 300_000,
  });
  const processor = createPostProductionProcessor({
    repository,
    outputDirectory: join(tempDirectory, "outputs"),
    now: () => now,
    leaseMs: 300_000,
    downloader: async (_assetUrl, scene) => join(tempDirectory, `scene-${scene.order}.mp4`),
    ffmpeg: {
      async run() {},
      async probe(outputPath) {
        if (outputPath.includes("square")) {
          return { width: 1080, height: 1080, durationSeconds: 20, hasVideo: true };
        }
        if (outputPath.includes("landscape")) {
          return { width: 1920, height: 1080, durationSeconds: 20, hasVideo: true };
        }
        return { width: 1080, height: 1920, durationSeconds: 20, hasVideo: true };
      },
    },
  });

  await scheduler.runOnce("worker-a");
  assert.equal(repository.get(job.id).status, "assembling");
  await processor.runOnce("worker-a");
  assert.equal(repository.get(job.id).status, "completed");
  assert.deepEqual(
    repository.getExports(job.id).map((item) => item.profile),
    ["vertical", "square", "landscape"],
  );
  assert.equal(
    repository.getAttempts(job.id).some((attempt) => attempt.category === "qa_passed"),
    true,
  );

  console.log("Video worker end-to-end fixture workflow passed.");
} finally {
  repository?.close();
  rmSync(tempDirectory, { recursive: true, force: true });
}
