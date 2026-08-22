import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirectory = mkdtempSync(join(tmpdir(), "giventake-video-worker-"));
let repository;

try {
  const { createWorkerRepository } = await import("../services/video-worker/src/repository.mjs");
  repository = createWorkerRepository({ databasePath: join(tempDirectory, "worker.db") });
  const job = {
    id: "job-0001",
    tenantId: "giventake-devs",
    campaignId: "campaign-0001",
    revisionId: "revision-0001",
    provider: "fixture",
    model: "fixture",
    budgetCents: 500,
    brand: { name: "GivenTake Devs", website: "giventakedevs.com", callToAction: "Book" },
    storyboard: [],
  };
  const createdAt = new Date("2026-08-21T12:00:00.000Z");

  assert.equal(repository.enqueue(job, "request-0001", createdAt).status, "queued");
  assert.equal(repository.hasRequest("request-0001"), true);

  const claimed = repository.claimNext("worker-a", createdAt, 300_000);
  assert.equal(claimed.status, "leased");
  assert.equal(claimed.leaseOwner, "worker-a");
  assert.equal(
    repository.claimNext("worker-b", new Date("2026-08-21T12:00:01.000Z"), 300_000),
    null,
  );

  const recovered = repository.claimNext("worker-b", new Date("2026-08-21T12:05:01.000Z"), 300_000);
  assert.equal(recovered.id, claimed.id);
  assert.equal(recovered.leaseOwner, "worker-b");
  assert.equal(repository.queueCounts().leased, 1);

  console.log("Video worker repository tests passed.");
} finally {
  repository?.close();
  rmSync(tempDirectory, { recursive: true, force: true });
}
