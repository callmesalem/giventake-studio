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
import { EXPECTATIONS, evaluate, pinnedCompatibilityDate } from "./worker-smoke-checks.mjs";

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

async function answers(url, timeoutMs) {
  try {
    return await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
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
  const full = [...args, "dev", "--local", "--ip", HOST, "--port", String(PORT)];
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

async function check() {
  const problems = [];
  for (const expectation of EXPECTATIONS) {
    const response = await answers(`${BASE}${expectation.path}`, REQUEST_TIMEOUT_MS);
    if (!response) {
      problems.push(`${expectation.path}: no response within ${REQUEST_TIMEOUT_MS / 1000}s`);
      continue;
    }
    const body = await response.text();
    const problem = evaluate(expectation, { status: response.status, body });
    log(`${expectation.path} -> ${response.status} ${problem ? "FAIL" : "ok"}`);
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
        `${problems.length} of ${EXPECTATIONS.length} expectations failed:\n  - ${problems.join("\n  - ")}`,
      );
    }

    log(`all ${EXPECTATIONS.length} expectations met under wrangler ${WRANGLER_VERSION}`);
  } finally {
    await stop();
  }
}

main().catch((error) => fail(error?.stack ?? String(error)));
