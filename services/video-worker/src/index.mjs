import { createWorkerConfig } from "./config.mjs";
import { createFfmpegRunner } from "./ffmpeg.mjs";
import { createFixtureDownloader } from "./fixture-media.mjs";
import { createWorkerHttpServer } from "./http-server.mjs";
import { createPostProductionProcessor } from "./post-production-processor.mjs";
import { createFixtureProvider } from "./providers.mjs";
import { createWorkerRepository } from "./repository.mjs";
import { createScheduler } from "./scheduler.mjs";

const config = createWorkerConfig();
if (!config.sharedSecret)
  throw new Error("STUDIO_WORKER_SHARED_SECRET is required to start the video worker.");
if (config.videoProvider !== "fixture") {
  throw new Error("Only the fixture provider is available in this worker release.");
}

const repository = createWorkerRepository({ databasePath: config.databasePath });
const server = createWorkerHttpServer({ repository, config });
const ffmpeg = createFfmpegRunner();
const scheduler = createScheduler({
  repository,
  providers: { fixture: createFixtureProvider() },
  rates: config.providerRates,
  leaseMs: config.leaseMs,
});
const processor = createPostProductionProcessor({
  repository,
  outputDirectory: config.outputDirectory,
  ffmpeg,
  downloader: createFixtureDownloader({ outputDirectory: config.outputDirectory }),
  leaseMs: config.leaseMs,
});
const address = await server.listen(config.port, config.host);

console.log(`GivenTake video worker listening on ${address.host}:${address.port}`);

let stopping = false;

async function runLoop() {
  while (!stopping) {
    try {
      await scheduler.runOnce(config.workerId);
      await processor.runOnce(config.workerId);
    } catch {
      // The queue keeps the failed job and its sanitized attempt records for review.
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

async function stop() {
  stopping = true;
  await server.close();
  repository.close();
}

process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
void runLoop();
