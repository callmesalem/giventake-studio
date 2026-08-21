import assert from "node:assert/strict";
import { createServer } from "vite";

const job = {
  id: "job-0001",
  tenantId: "giventake-devs",
  campaignId: "campaign-0001",
  revisionId: "revision-0001",
  provider: "fixture",
  model: "fixture",
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

const calls = [];
const fetchMock = async (url, init = {}) => {
  calls.push({ url, init });
  return new Response(JSON.stringify({ id: job.id, status: "queued" }), { status: 202 });
};

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });

try {
  const { createProductionWorkerClient } = await vite.ssrLoadModule(
    "/src/lib/studio/production-worker-client.ts",
  );
  const client = createProductionWorkerClient({
    baseUrl: "http://worker.internal/",
    sharedSecret: "worker-secret",
    fetch: fetchMock,
    now: () => new Date("2026-08-21T12:00:00.000Z"),
    requestId: () => "request-0001",
  });

  const result = await client.enqueue(job);
  assert.deepEqual(result, { id: job.id, status: "queued" });
  assert.equal(calls[0].url, "http://worker.internal/v1/jobs");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.get("x-studio-timestamp"), "2026-08-21T12:00:00.000Z");
  assert.equal(calls[0].init.headers.get("x-studio-request-id"), "request-0001");
  assert.match(calls[0].init.headers.get("x-studio-signature"), /^[a-f0-9]{64}$/);
  assert.equal(calls[0].init.headers.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(calls[0].init.body), job);

  console.log("Video worker client tests passed.");
} finally {
  await vite.close();
}
