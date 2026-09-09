# Worker Smoke Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a build that the Cloudflare Workers runtime rejects fail CI (and one local command) instead of production, and stop the compatibility date from floating with the build day.

**Architecture:** A pure module (`scripts/worker-smoke-checks.mjs`) holds the request expectations and the two decision functions, so they are unit-tested under the repo's `node --test` runner. A runner (`scripts/worker-smoke.mjs`) does the side effects: preflight on the build output, spawn a pinned wrangler under the real runtime, poll readiness, fetch, evaluate, tear down. `wrangler.jsonc` pins `compatibility_date`; the runner refuses a build whose emitted date differs. A new gating CI job builds and runs the runner.

**Tech Stack:** Node 24 (`node:test`, global `fetch`, `child_process`), wrangler 4.130.0 via `bunx` (CI) or `npx -y` (machines without bun), GitHub Actions, nitro's cloudflare preset (`.output/server/wrangler.json`).

**Spec:** `docs/superpowers/specs/2026-09-09-worker-smoke-check-design.md`

---

## File structure

| File | Responsibility |
|---|---|
| `wrangler.jsonc` (modify) | Pin `compatibility_date`. Nitro merges this file over its generated defaults, so the value wins. |
| `scripts/worker-smoke-checks.mjs` (create) | Pure: the expectations table, `pinnedCompatibilityDate(text)`, `evaluate(expectation, response)`. No I/O. |
| `tests/worker-smoke-checks.test.mjs` (create) | Unit tests for the pure module, run by the existing `bun run test` loop. |
| `scripts/worker-smoke.mjs` (create) | Runner: preflight, spawn wrangler, readiness, fetch, evaluate, teardown, failure output. |
| `package.json` (modify) | `"smoke:worker": "node scripts/worker-smoke.mjs"`. |
| `.github/workflows/ci.yml` (modify) | New gating `worker` job: install, build, smoke. |

Local note: this machine has no `bun`; use `npm run build` where the plan says build. CI uses `bun run build`. The runner picks `bunx` when present, else `npx -y`.

---

### Task 1: Pin the compatibility date

**Files:**
- Modify: `wrangler.jsonc` (after the `"name"` line, before `"routes"`)

- [ ] **Step 1: Record the current floating value**

Run: `npm run build >/dev/null 2>&1; grep compatibility_date .output/server/wrangler.json`
Expected: `"compatibility_date": "2026-09-06",` (nitro's `"latest"` resolves to a recent date; a later day may print a later date, which is exactly the problem)

- [ ] **Step 2: Add the pin**

Insert directly after the line `"name": "callmesalem-giventake-studio",`:

```jsonc
  // Pinned on purpose. nitro leaves compatibilityDate at "latest", which
  // writes a recent date into the generated wrangler.json on every build - so
  // each rebuild silently opted into whatever runtime behaviour Cloudflare had
  // gated behind a newer date (a 2026-09-02 build got 2026-08-30, a 2026-09-09
  // build got 2026-09-06). This file wins over that default (defu in nitro's
  // cloudflare preset), so runtime behaviour now changes only when this line
  // does. Bump deliberately: edit it, run the build and `bun run smoke:worker`,
  // and review the change like code. scripts/worker-smoke.mjs refuses a build
  // whose emitted date differs from this one.
  "compatibility_date": "2026-09-06",
```

The comment must not contain the quoted key followed by a quoted date, because `scripts/worker-smoke-checks.mjs` finds the pin with a regex on the raw file.

- [ ] **Step 3: Verify the pin reaches the build**

Run: `npm run build >/dev/null 2>&1; grep compatibility_date .output/server/wrangler.json`
Expected: `"compatibility_date": "2026-09-06",`

Run: `npm run build 2>&1 | grep -i "overridden"`
Expected: no output (nitro only warns for keys it force-overrides; the date is not one)

- [ ] **Step 4: Commit**

```bash
git add wrangler.jsonc
git commit -m "chore(cloudflare): pin compatibility_date instead of emitting the build day's"
```

---

### Task 2: The pure checks module

**Files:**
- Create: `scripts/worker-smoke-checks.mjs`
- Test: `tests/worker-smoke-checks.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `tests/worker-smoke-checks.test.mjs`:

```js
// The decisions behind scripts/worker-smoke.mjs, tested without a runtime.
//
// The runner exists because CI never executed the built Worker under the
// Workers runtime, and on 2026-09-08 a module-scope Response reached
// production green and took every page to 500. The runner's side effects
// (spawn, poll, fetch) are exercised by running it; the judgements it makes
// live here so they can be pinned down exactly.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ERROR_PAGE_MARKER,
  EXPECTATIONS,
  evaluate,
  pinnedCompatibilityDate,
} from "../scripts/worker-smoke-checks.mjs";

// --- pinnedCompatibilityDate ------------------------------------------------

test("finds the pinned date in a JSONC file with comments around it", () => {
  const text = [
    "{",
    "  // why this is pinned",
    '  "name": "x",',
    '  "compatibility_date": "2026-09-06",',
    '  "routes": [],',
    "}",
  ].join("\n");
  assert.equal(pinnedCompatibilityDate(text), "2026-09-06");
});

test("returns null when no date is pinned", () => {
  assert.equal(pinnedCompatibilityDate('{ "name": "x" }'), null);
});

test("ignores a value that is not a date", () => {
  assert.equal(pinnedCompatibilityDate('{ "compatibility_date": "latest" }'), null);
});

// --- EXPECTATIONS -----------------------------------------------------------

test("the table covers the home page, a CRM page, the public sign route, and a 404", () => {
  const paths = EXPECTATIONS.map((e) => e.path);
  assert.ok(paths.includes("/"));
  assert.ok(paths.some((p) => p.startsWith("/crm/")));
  assert.ok(paths.some((p) => p.startsWith("/sign/")));
  assert.ok(EXPECTATIONS.some((e) => e.status === 404));
});

test("every 200 expectation refuses the generic error page", () => {
  for (const e of EXPECTATIONS.filter((e) => e.status === 200)) {
    assert.equal(e.mustNotContain, ERROR_PAGE_MARKER, e.path);
  }
});

test("the marker is the title src/lib/error-page.ts renders", () => {
  assert.equal(ERROR_PAGE_MARKER, "This page didn't load");
});

// --- evaluate ---------------------------------------------------------------

const home = EXPECTATIONS.find((e) => e.path === "/");
const sign = EXPECTATIONS.find((e) => e.path.startsWith("/sign/"));
const missing = EXPECTATIONS.find((e) => e.status === 404);

test("a wrong status is reported with both numbers", () => {
  const problem = evaluate(home, { status: 500, body: "<h1>This page didn't load</h1>" });
  assert.match(problem, /expected 200/);
  assert.match(problem, /got 500/);
});

test("a 200 that carries the generic error page is still a failure", () => {
  const problem = evaluate(home, { status: 200, body: "<title>This page didn't load</title>" });
  assert.match(problem, /This page didn't load/);
});

test("a healthy page passes", () => {
  assert.equal(evaluate(home, { status: 200, body: "<title>GivenTake Devs</title>" }), null);
});

test("the sign route must show its refusal page, not just answer 200", () => {
  assert.match(evaluate(sign, { status: 200, body: "<title>Signed</title>" }), /Link unavailable/);
  assert.equal(evaluate(sign, { status: 200, body: "<title>Link unavailable</title>" }), null);
});

test("an unknown path must be a 404, and a body is not inspected", () => {
  assert.equal(evaluate(missing, { status: 404, body: "" }), null);
  assert.match(evaluate(missing, { status: 200, body: "" }), /expected 404/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types tests/worker-smoke-checks.test.mjs`
Expected: FAIL with `Cannot find module '.../scripts/worker-smoke-checks.mjs'`

- [ ] **Step 3: Write the module**

Create `scripts/worker-smoke-checks.mjs`:

```js
// The judgements scripts/worker-smoke.mjs makes, kept pure so
// tests/worker-smoke-checks.test.mjs can pin them down without a runtime.

/** The <title> of src/lib/error-page.ts - what production served, with
 *  status 500, on every path during the 2026-09-08 outage. A 200 carrying it
 *  is still a broken page. */
export const ERROR_PAGE_MARKER = "This page didn't load";

/**
 * What the built Worker must answer with no environment at all. Every path
 * here renders without Supabase, Resend or OpenAI configured; anything that
 * needs a secret does not belong in this table.
 *
 * /sign/<token> is the route that took the site down. With no Supabase
 * config its handler refuses with the "Link unavailable" page, which is the
 * exact code path that used to be built at module scope.
 */
export const EXPECTATIONS = Object.freeze([
  { path: "/", status: 200, mustNotContain: ERROR_PAGE_MARKER },
  { path: "/careers", status: 200, mustNotContain: ERROR_PAGE_MARKER },
  { path: "/crm/login", status: 200, mustNotContain: ERROR_PAGE_MARKER },
  {
    path: "/sign/smoke-probe",
    status: 200,
    mustContain: "Link unavailable",
    mustNotContain: ERROR_PAGE_MARKER,
  },
  { path: "/definitely-not-a-page", status: 404 },
]);

/**
 * The compatibility_date pinned in wrangler.jsonc, or null.
 *
 * A regex rather than a JSONC parser: the file is committed, hand-written,
 * and the only thing wanted from it is one dated string. The date form is
 * required, so `"latest"` reads as "not pinned".
 */
export function pinnedCompatibilityDate(wranglerJsoncText) {
  const match = /"compatibility_date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/.exec(wranglerJsoncText);
  return match ? match[1] : null;
}

/**
 * Null when the response satisfies the expectation, otherwise one line saying
 * what was wrong. Status first: a body check on the wrong status would report
 * the symptom, not the fact.
 */
export function evaluate(expectation, response) {
  const { path } = expectation;
  if (response.status !== expectation.status) {
    return `${path}: expected ${expectation.status}, got ${response.status}`;
  }
  if (expectation.mustContain && !response.body.includes(expectation.mustContain)) {
    return `${path}: body does not contain "${expectation.mustContain}"`;
  }
  if (expectation.mustNotContain && response.body.includes(expectation.mustNotContain)) {
    return `${path}: body contains "${expectation.mustNotContain}" - the generic error page`;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --experimental-strip-types tests/worker-smoke-checks.test.mjs`
Expected: `# pass 11`, `# fail 0`

- [ ] **Step 5: Lint the two files**

Run: `npx eslint scripts/worker-smoke-checks.mjs tests/worker-smoke-checks.test.mjs`
Expected: no output, exit 0 (if it reports only `Delete ␍` prettier errors, that is the Windows checkout's line endings, not the code; `git ls-files --eol` shows the index is LF)

- [ ] **Step 6: Commit**

```bash
git add scripts/worker-smoke-checks.mjs tests/worker-smoke-checks.test.mjs
git commit -m "test(ci): the judgements of the Worker smoke check, pure and pinned"
```

---

### Task 3: The runner and the package script

**Files:**
- Create: `scripts/worker-smoke.mjs`
- Modify: `package.json` (the `"scripts"` block, after `"test:e2e"`)

- [ ] **Step 1: Write the runner**

Create `scripts/worker-smoke.mjs`:

```js
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
    return fail(`port ${PORT} is already answering - stop whatever is on it, this script will not pick another`);
  }

  start();
  try {
    const readiness = await waitUntilReady();
    if (readiness) return fail(readiness);
    log("ready");

    const problems = await check();
    if (problems.length > 0) {
      return fail(`${problems.length} of ${EXPECTATIONS.length} expectations failed:\n  - ${problems.join("\n  - ")}`);
    }

    log(`all ${EXPECTATIONS.length} expectations met under wrangler ${WRANGLER_VERSION}`);
  } finally {
    await stop();
  }
}

main().catch((error) => fail(error?.stack ?? String(error)));
```

- [ ] **Step 2: Add the package script**

In `package.json`, after `"test:e2e": "playwright test"`, add:

```json
    "smoke:worker": "node scripts/worker-smoke.mjs"
```

(Add the comma to the `test:e2e` line.)

- [ ] **Step 3: Verify it fails without a build**

Run: `rm -rf .output && node scripts/worker-smoke.mjs; echo "exit $?"`
Expected: `[worker-smoke] FAIL: no build output ...` then `exit 1`

- [ ] **Step 4: Verify it fails on the broken commit (red)**

Put the pre-#40 route back temporarily, build, run:

```bash
git show c2942c9:'src/routes/sign.$token.tsx' > 'src/routes/sign.$token.tsx'
npm run build >/dev/null 2>&1
node scripts/worker-smoke.mjs; echo "exit $?"
git checkout -- 'src/routes/sign.$token.tsx'
```

Expected: `/ -> 500 FAIL` and the same for every other path, including the unknown one (routing lives in the chunk that fails to import, so nothing gets as far as a 404), `FAIL: 5 of 5 expectations failed`, then the wrangler output containing `Disallowed operation called within global scope`, then `exit 1`.

- [ ] **Step 5: Verify it passes on the current code (green)**

Run: `npm run build >/dev/null 2>&1 && node scripts/worker-smoke.mjs; echo "exit $?"`
Expected: five `ok` lines, `all 5 expectations met under wrangler 4.130.0`, `exit 0`, and no wrangler process left behind (`tasklist | grep -i workerd` on Windows prints nothing)

- [ ] **Step 6: Lint**

Run: `npx eslint scripts/worker-smoke.mjs`
Expected: exit 0 (line-ending-only complaints excepted, as in Task 2)

- [ ] **Step 7: Commit**

```bash
git add scripts/worker-smoke.mjs package.json
git commit -m "feat(ci): a smoke check that runs the built Worker under the real runtime"
```

---

### Task 4: The CI job, the PR, and the proof

**Files:**
- Modify: `.github/workflows/ci.yml` (append after the `e2e` job, before `a11y`)

- [ ] **Step 1: Add the job**

Insert between the `e2e` job and the `a11y` job:

```yaml
  # The only job that runs the Cloudflare Workers runtime. Everything above
  # runs under Node, and Node allows what Workers forbids: on 2026-09-08 a
  # Response built at module scope passed every job here and took every page
  # on every domain to 500 for a day. This boots the built Worker under a
  # pinned wrangler and asks it for five pages (scripts/worker-smoke.mjs). It
  # gates, because a green pipeline that production rejects is worse than a
  # red one.
  worker:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install
        run: bun install

      - name: Build
        run: bun run build

      - name: Smoke the built Worker under the Workers runtime
        run: bun run smoke:worker
```

- [ ] **Step 2: Validate the YAML parses**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); console.log((y.match(/^  [a-z0-9]+:$/gm)||[]).join(' '))"`
Expected: `verify: e2e: worker: a11y:` (job keys in order; a stray indent would drop `worker:` from the list)

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: gate merges on the built Worker booting under the Workers runtime"
git push -u origin chore/worker-smoke-check
```

- [ ] **Step 4: Open the PR**

Via the pre-filled compare URL in Chrome (no gh CLI here): base `main`, compare `chore/worker-smoke-check`. Title: `ci: run the built Worker under the real runtime, and pin the compatibility date`. Body: link the spec, state the 2026-09-08 outage this prevents, list the five paths, note the pinned date changes nothing in production, and paste the red-run excerpt from Task 3 Step 4 as proof the check catches the original bug.

- [ ] **Step 5: Watch the PR's CI**

Expected: `verify`, `e2e`, and the new `worker` job green; `a11y` advisory as before. If `worker` fails, its log ends with wrangler's output; read the stack before changing anything.

---

## Self-review

- **Spec coverage.** Pin (Task 1); pure checks and table (Task 2); preflight, boot, readiness, expectations, teardown, failure output, fixed port (Task 3); CI job and package script (Tasks 3-4); red-then-green verification and PR CI (Tasks 3-4). Non-goals untouched.
- **Placeholders.** None; every code step shows the code, every run step shows the expected output.
- **Consistency.** `ERROR_PAGE_MARKER`, `EXPECTATIONS`, `evaluate`, `pinnedCompatibilityDate` are the same names in the module, the tests, and the runner. Port 8788, wrangler 4.130.0, and date 2026-09-06 appear with the same values throughout.
