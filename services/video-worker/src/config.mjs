import { join } from "node:path";

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function enabled(value, fallback) {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function providerRates(value) {
  if (!value) return { fixture: { fixture: 0 } };
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object")
    throw new Error("STUDIO_WORKER_PROVIDER_RATES_JSON must be JSON.");
  return parsed;
}

export function createWorkerConfig(env = process.env) {
  const dataDirectory = env.STUDIO_WORKER_DATA_DIR ?? "/var/lib/giventake-video-worker";
  return {
    host: env.STUDIO_WORKER_HOST ?? "127.0.0.1",
    port: positiveInteger(env.STUDIO_WORKER_PORT, 8788),
    dataDirectory,
    databasePath: env.STUDIO_WORKER_DATABASE_PATH ?? join(dataDirectory, "worker.db"),
    outputDirectory: env.STUDIO_WORKER_OUTPUT_DIR ?? join(dataDirectory, "outputs"),
    sharedSecret: env.STUDIO_WORKER_SHARED_SECRET ?? "",
    outboundKillSwitch: enabled(env.STUDIO_OUTBOUND_KILL_SWITCH, true),
    maxBodyBytes: positiveInteger(env.STUDIO_WORKER_MAX_BODY_BYTES, 1_000_000),
    leaseMs: positiveInteger(env.STUDIO_WORKER_LEASE_MS, 300_000),
    pollIntervalMs: positiveInteger(env.STUDIO_WORKER_POLL_INTERVAL_MS, 1_000),
    videoProvider: env.STUDIO_VIDEO_PROVIDER ?? "fixture",
    providerRates: providerRates(env.STUDIO_WORKER_PROVIDER_RATES_JSON),
    workerId: env.STUDIO_WORKER_ID ?? `video-worker-${process.pid}`,
  };
}
