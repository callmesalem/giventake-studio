# Worker smoke check and pinned compatibility date

**Date:** 2026-09-09
**Status:** approved design, not yet implemented
**Follows:** PR #40 (`fix(sign): build the refusal page per request, not at module scope`)

## Why

From the 2026-09-08 deploy of `main` until 2026-09-09, every page on
giventakedevs.com, www.giventakedevs.com and crm.giventakedevs.com answered
500. One route module constructed a `Response` at module scope; the Cloudflare
Workers runtime refuses that ("Disallowed operation called within global
scope"), the router chunk failed to import, and the SSR wrapper rendered its
generic error page for every path.

CI was green the whole time. Lint, `tsc`, the unit suite, the component suite,
Playwright and the build all run under Node, and Node allows what Workers
forbids. Nothing in `ci.yml` ever executes the built Worker under the runtime
that serves production.

A second, smaller finding from the same day: nitro leaves `compatibilityDate`
at `"latest"`, so every build emits a fresh Cloudflare compatibility date (a
2026-09-02 build emitted 2026-08-30; a 2026-09-09 build emitted 2026-09-06).
Runtime behaviour therefore changes whenever anyone rebuilds, without a commit
that says so.

## Goals

1. A module-scope violation, or anything else that makes the built Worker
   answer 500 under the real runtime, fails the pull request instead of
   production.
2. One command answers "does the Workers runtime accept this build" locally,
   identically to CI.
3. The compatibility date changes only when someone edits a committed file.

## Non-goals

- Running the Playwright suite against the Workers runtime. The e2e and a11y
  jobs keep the Vite dev server; this is a separate, narrow gate.
- Exercising paths that need secrets (Supabase, Resend, OpenAI). The smoke
  check runs with no environment; every path it fetches must render without
  one.
- Rebasing or verifying the two dependency-bump branches. Separate work.

## Design

### 1. Pin the compatibility date in `wrangler.jsonc`

Add `"compatibility_date": "2026-09-06"` to `wrangler.jsonc`, with a comment
explaining that nitro would otherwise emit the build day's date, and that a
bump is a deliberate change reviewed like any other. Nitro merges this file
over its generated defaults (`defu(overrides, ctxConfig, userConfig,
defaults)` in the cloudflare preset), so the value wins.

`2026-09-06` is what the 2026-09-09 local build of `main` emitted, and the
production build of the same day ran the same nitro logic, so by inference it
carries the same date and pinning it changes nothing in production. (Cloudflare
access is not available from this machine to read the deployed value.) It is also
within what wrangler 4.130.0's bundled runtime supports, so CI and local runs
honour it rather than silently falling back.

### 2. `scripts/worker-smoke.mjs`

Plain Node, no dependencies, runnable as `bun run smoke:worker` after
`bun run build`.

Steps, in order; the first failure stops the run with exit code 1:

1. **Build output present.** `.output/server/wrangler.json` must exist.
   Otherwise: "run the build first".
2. **Date is pinned.** The emitted `compatibility_date` must equal the one in
   `wrangler.jsonc` (read with a regex for the key, so no JSONC parser is
   needed). A mismatch means the pin stopped reaching the build.
3. **Boot the Worker.** Spawn `bunx wrangler@4.130.0 dev --local --ip
   127.0.0.1 --port 8788` from the repository root (wrangler must start from
   the root because nitro writes `.wrangler/deploy/config.json` there), with
   `WRANGLER_SEND_METRICS=false`. Capture stdout and stderr. The wrangler
   version is a named constant with a comment: older runtimes cap the
   compatibility date and fall back silently, which would test a different
   runtime than production.
4. **Readiness.** Poll `http://127.0.0.1:8788/robots.txt` until it answers
   200, up to 180 seconds (the first CI run downloads wrangler and workerd).
   Timeout is a failure and prints the captured output.
5. **Requests and expectations.**

   | Path                     | Expect                                                  |
   |--------------------------|---------------------------------------------------------|
   | `/`                      | 200, body does not contain `This page didn't load`      |
   | `/careers`               | 200, body does not contain `This page didn't load`      |
   | `/crm/login`             | 200, body does not contain `This page didn't load`      |
   | `/sign/smoke-probe`      | 200, body contains `Link unavailable`                   |
   | `/definitely-not-a-page` | 404                                                     |

   The generic error page check is the point of the exercise: it is exactly
   what production served during the outage, with status 500. Assertions are
   not retried; only readiness is.
6. **Teardown.** Always stop the wrangler process tree: `taskkill /T /F` on
   Windows, `SIGTERM` to the process group elsewhere. On any failure, print
   the captured wrangler output in full before exiting, because that is where
   the runtime's stack trace lands.

Port 8788 is fixed. If it is busy the run fails immediately rather than
picking another port, matching `playwright.config.ts`'s strict-port reasoning.

### 3. CI job

A new job `worker` in `.github/workflows/ci.yml`, gating (no
`continue-on-error`), alongside `verify` and `e2e`:

```yaml
worker:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
    - run: bun install
    - run: bun run build
    - run: bun run smoke:worker
```

With a comment above it naming the 2026-09-08 outage and stating that this
is the only job that runs the Workers runtime.

### 4. `package.json`

Add `"smoke:worker": "node scripts/worker-smoke.mjs"`.

## Verification

- Run the script against a build of `c2942c9` (the broken `main`): it must
  fail on `/` with status 500 and print the "Disallowed operation called
  within global scope" stack from wrangler's output.
- Run it against a build of current `main`: every expectation passes.
- The pull request's own CI run shows the `worker` job green.

## Risks

- **Download time.** `bunx wrangler@4.130.0` fetches roughly 100 MB on a
  cold runner. Accepted; the 180-second readiness budget covers it, and the
  alternative (a devDependency) would add that weight to every install,
  including Lovable's.
- **Flakiness.** The only timing-dependent step is readiness, which polls.
  Assertions are single requests against a warm local server.
- **Drift.** If a new route starts rendering the generic page for a reason
  unrelated to the runtime, the job fails; that is the intended behaviour.
