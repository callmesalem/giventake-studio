import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirectory = mkdtempSync(join(tmpdir(), "giventake-video-worker-"));
let repository;

function makeJob(overrides = {}) {
  return {
    id: `job-${overrides.id ?? "0001"}`,
    tenantId: "giventake-devs",
    campaignId: "campaign-0001",
    revisionId: "revision-0001",
    provider: "sora",
    model: "sora-2",
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
    ...overrides,
  };
}

try {
  const { createWorkerRepository } = await import("../services/video-worker/src/repository.mjs");
  const { createScheduler } = await import("../services/video-worker/src/scheduler.mjs");
  repository = createWorkerRepository({ databasePath: join(tempDirectory, "worker.db") });
  let now = new Date("2026-08-21T12:00:00.000Z");
  const blockedProvider = {
    submitCalls: 0,
    async submit() {
      this.submitCalls += 1;
      return "provider-job";
    },
    async poll() {
      return { state: "completed", result: { assetUrl: "fixture://video", durationSeconds: 5 } };
    },
  };
  const budgetJob = makeJob({ id: "budget", budgetCents: 174 });
  repository.enqueue(budgetJob, "request-budget", now);
  const scheduler = createScheduler({
    repository,
    providers: { sora: blockedProvider },
    rates: { sora: { "sora-2": 35 } },
    now: () => now,
    leaseMs: 300_000,
  });

  await scheduler.runOnce("worker-a");
  assert.equal(blockedProvider.submitCalls, 0);
  assert.equal(repository.get(budgetJob.id).status, "failed");
  assert.equal(repository.getAttempts(budgetJob.id).at(-1).category, "budget_exceeded");

  const pendingProvider = {
    submitCalls: 0,
    async submit() {
      this.submitCalls += 1;
      return "provider-pending";
    },
    async poll() {
      return { state: "pending", retryAfterMs: 15_000 };
    },
  };
  const pendingJob = makeJob({ id: "pending" });
  repository.enqueue(pendingJob, "request-pending", now);
  const pendingScheduler = createScheduler({
    repository,
    providers: { sora: pendingProvider },
    rates: { sora: { "sora-2": 35 } },
    now: () => now,
    leaseMs: 300_000,
  });

  await pendingScheduler.runOnce("worker-a");
  const pending = repository.get(pendingJob.id);
  assert.equal(pending.status, "waiting_for_provider");
  assert.equal(pending.runtime.sceneRequests[1].providerRequestId, "provider-pending");
  assert.equal(pendingProvider.submitCalls, 1);

  console.log("Video worker scheduler tests passed.");
} finally {
  repository?.close();
  rmSync(tempDirectory, { recursive: true, force: true });
}
