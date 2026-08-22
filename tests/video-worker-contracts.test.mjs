import assert from "node:assert/strict";
import { createServer } from "vite";

const job = {
  id: "job-0001",
  tenantId: "giventake-devs",
  campaignId: "campaign-0001",
  revisionId: "revision-0001",
  provider: "sora",
  model: "sora-2",
  budgetCents: 500,
  brand: {
    name: "GivenTake Devs",
    website: "giventakedevs.com",
    callToAction: "Book a discovery call",
  },
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

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const { createCostPolicy, createWorkerSignature, verifyWorkerSignature } =
    await vite.ssrLoadModule("/src/lib/studio/render-job.ts");
  const timestamp = "2026-08-21T12:00:00.000Z";
  const signature = await createWorkerSignature(job, "worker-secret", timestamp, "request-1");

  assert.equal(
    await verifyWorkerSignature(
      job,
      signature,
      "worker-secret",
      timestamp,
      "request-1",
      new Date("2026-08-21T12:01:00.000Z"),
    ),
    true,
  );
  assert.equal(
    await verifyWorkerSignature(
      job,
      signature,
      "wrong-secret",
      timestamp,
      "request-1",
      new Date("2026-08-21T12:01:00.000Z"),
    ),
    false,
  );
  assert.equal(
    await verifyWorkerSignature(
      job,
      signature,
      "worker-secret",
      timestamp,
      "request-1",
      new Date("2026-08-21T12:06:01.000Z"),
    ),
    false,
  );

  const policy = createCostPolicy({ sora: { "sora-2": 35 }, fixture: { fixture: 0 } });
  assert.equal(policy.reserve(job), 175);
  assert.throws(() => policy.reserve({ ...job, budgetCents: 174 }), /budget/i);
  assert.throws(() => createCostPolicy({ sora: {} }).reserve(job), /pricing/i);

  console.log("Video worker contract tests passed.");
} finally {
  await vite.close();
}
