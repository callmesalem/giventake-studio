#!/usr/bin/env node
// Boots the built Worker under the real Cloudflare Workers runtime and asks
// it for a handful of pages.
//
// Why this exists: on 2026-09-08 a route module constructed a Response at
// module scope. Node allows that, so lint, tsc, every test suite and the
// build stayed green; the Workers runtime does not ("Disallowed operation
// called within global scope"), so every page on every domain answered 500
// until 2026-09-09. Nothing in CI executed the runtime that serves
// production. This does.
//
// Usage: build first, then `bun run smoke:worker` (or `node
// scripts/worker-smoke.mjs`). Exit 0 means the runtime served every path in
// scripts/worker-smoke-checks.mjs as expected; exit 1 prints why, followed
// by wrangler's full output, which is where the runtime's stack trace lands.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTATIONS,
  MCP_EXPECTATIONS,
  MCP_SMOKE_KEY,
  evaluate,
  pinnedCompatibilityDate,
} from "./worker-smoke-checks.mjs";

// The bundled runtime caps the compatibility date it will honour, and an older
// wrangler FALLS BACK SILENTLY to its cap: 4.76.0 ran a 2026-09-06 build as
// 2026-03-17 and reported success. Pin a version whose runtime accepts the
// date wrangler.jsonc pins, and bump the two together.
const WRANGLER_VERSION = "4.130.0";
const HOST = "127.0.0.1";
const PORT = 8788; // fixed, like playwright.config.ts: a busy port fails, it does not wander
const BASE = `http://${HOST}:${PORT}`;
const READY_TIMEOUT_MS = 180_000; // a cold runner downloads wrangler and workerd first
const REQUEST_TIMEOUT_MS = 20_000;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WIN = process.platform === "win32";

let child = null;
let captured = "";

function log(line) {
  process.stdout.write(`[worker-smoke] ${line}\n`);
}

function fail(reason) {
  process.stdout.write(`\n[worker-smoke] FAIL: ${reason}\n`);
  if (captured.trim()) {
    process.stdout.write("\n----- wrangler output -----\n");
    process.stdout.write(captured);
    process.stdout.write("\n----- end wrangler output -----\n");
  }
  process.exitCode = 1;
}

function hasCommand(name) {
  try {
    execFileSync(WIN ? "where" : "which", [name], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** bunx on CI and bun machines; npx elsewhere. Both resolve the pinned version. */
function wranglerCommand() {
  if (hasCommand("bunx")) return ["bunx", [`wrangler@${WRANGLER_VERSION}`]];
  return ["npx", ["-y", `wrangler@${WRANGLER_VERSION}`]];
}

async function answers(url, timeoutMs, init = {}) {
  try {
    return await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function preflight() {
  const generatedPath = resolve(ROOT, ".output/server/wrangler.json");
  if (!existsSync(generatedPath)) {
    return "no build output at .output/server/wrangler.json - run the build first";
  }
  const emitted = JSON.parse(readFileSync(generatedPath, "utf8")).compatibility_date;
  const pinned = pinnedCompatibilityDate(readFileSync(resolve(ROOT, "wrangler.jsonc"), "utf8"));
  if (!pinned) return "wrangler.jsonc pins no compatibility_date - the pin is missing";
  if (emitted !== pinned) {
    return `the build emitted compatibility_date ${emitted} but wrangler.jsonc pins ${pinned} - the pin is not reaching the build`;
  }
  log(`build output present, compatibility_date ${emitted} matches the pin`);
  return null;
}

function start() {
  const [command, args] = wranglerCommand();
  // --host: wrangler dev's local runtime otherwise sets the Worker's request
  // host/url to the zone of the project's first route (giventakedevs.com, the
  // public site). /mcp's host gate (src/server/mcp/auth.ts) only admits
  // crm.giventakedevs.com, localhost and 127.0.0.1, so without this every
  // request to /mcp - any method - would 404 before auth ever runs, even
  // though production on crm.giventakedevs.com is unaffected.
  const full = [
    ...args,
    "dev",
    "--local",
    "--ip",
    HOST,
    "--port",
    String(PORT),
    "--host",
    "crm.giventakedevs.com",
    "--var",
    `MCP_PERPLEXITY_KEY:${MCP_SMOKE_KEY}`,
  ];
  log(`starting: ${command} ${full.join(" ")}`);
  child = spawn(command, full, {
    cwd: ROOT, // nitro writes .wrangler/deploy/config.json here; wrangler must start here to find it
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "true" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: WIN, // .cmd shims need a shell on Windows
    detached: !WIN, // a process group, so teardown reaches workerd too
  });
  child.stdout.on("data", (chunk) => (captured += chunk));
  child.stderr.on("data", (chunk) => (captured += chunk));
}

async function waitUntilReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return `wrangler exited early with code ${child.exitCode}`;
    const response = await answers(`${BASE}/robots.txt`, 2_000);
    if (response && response.status === 200) return null;
    await sleep(1_000);
  }
  return `not ready within ${READY_TIMEOUT_MS / 1000}s`;
}

// wrangler 4.130.0's local runtime (Miniflare, with an Assets binding
// configured) has a dev-only connection bug: a GET served through the Assets
// binding, followed by a second POST to the Worker, can drop the reused
// loopback connection and answer that POST with a 500 body of "Error:
// Network connection lost." from miniflare's entry.worker.js - never
// reaching the app. Running the POST-heavy MCP_EXPECTATIONS before any GET
// avoids the trigger almost always; it can still happen (observed once
// across many runs even with no prior GET), so a single retry below is
// scoped to exactly that fingerprint.
const MINIFLARE_CONNECTION_LOST = "Network connection lost";

async function check() {
  const problems = [];
  const all = [...MCP_EXPECTATIONS, ...EXPECTATIONS];
  for (const expectation of all) {
    const label = expectation.name ?? expectation.path;
    const init = expectation.method
      ? { method: expectation.method, headers: expectation.headers ?? {}, body: expectation.body }
      : {};
    let response = await answers(`${BASE}${expectation.path}`, REQUEST_TIMEOUT_MS, init);
    let body = response ? await response.text() : "";
    if (response && response.status === 500 && body.includes(MINIFLARE_CONNECTION_LOST)) {
      log(`${label} -> 500 (${MINIFLARE_CONNECTION_LOST}) - retrying once`);
      response = await answers(`${BASE}${expectation.path}`, REQUEST_TIMEOUT_MS, init);
      body = response ? await response.text() : "";
    }
    if (!response) {
      problems.push(`${label}: no response within ${REQUEST_TIMEOUT_MS / 1000}s`);
      continue;
    }
    const problem = evaluate({ ...expectation, path: label }, { status: response.status, body });
    log(`${label} -> ${response.status} ${problem ? "FAIL" : "ok"}`);
    if (problem) problems.push(problem);
  }
  return problems;
}

async function stop() {
  if (!child || child.exitCode !== null) return;
  try {
    if (WIN) execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    // already gone
  }
  await Promise.race([new Promise((r) => child.once("exit", r)), sleep(5_000)]);
}

async function main() {
  const preflightProblem = preflight();
  if (preflightProblem) return fail(preflightProblem);

  if (await answers(`${BASE}/`, 1_500)) {
    return fail(
      `port ${PORT} is already answering - stop whatever is on it, this script will not pick another`,
    );
  }

  start();
  try {
    const readiness = await waitUntilReady();
    if (readiness) return fail(readiness);
    log("ready");

    const problems = await check();
    if (problems.length > 0) {
      return fail(
        `${problems.length} of ${EXPECTATIONS.length + MCP_EXPECTATIONS.length} expectations failed:\n  - ${problems.join("\n  - ")}`,
      );
    }

    log(
      `all ${EXPECTATIONS.length + MCP_EXPECTATIONS.length} expectations met under wrangler ${WRANGLER_VERSION}`,
    );
  } finally {
    await stop();
  }
}

main().catch((error) => fail(error?.stack ?? String(error)));
