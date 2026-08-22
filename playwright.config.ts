import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the real application in a real browser.
 *
 * Scope is the PUBLIC surface: the marketing pages and the contact form. That
 * is deliberate, and it is where the value is — the contact form silently lost
 * every lead for weeks, and none of the checks that existed could have caught
 * it. The CRM behind the login is covered only to the extent of proving it
 * refuses anonymous visitors; testing it properly needs a seeded database and a
 * dedicated account, which is a decision about production data rather than
 * about test tooling.
 *
 * Nothing here writes to the database. The form submission is intercepted in
 * the browser and asserted on, so the request never reaches the server.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // A failing E2E test is usually a real failure, but flake exists; one retry
  // in CI distinguishes the two without hiding a genuine break.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "list" : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:8099",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Reuse an already-running dev server locally; start one in CI. Without
  // reuseExistingServer a local run either fails on a busy port or silently
  // tests a different server than the one the developer is looking at.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // A dedicated port, and strictPort so a collision FAILS rather than
        // silently moving. The default 8080 is taken by tailscaled on the build
        // host, and vite quietly served 8081 while the tests asserted against
        // 8080 — a suite that tests a different server than the one it names is
        // worse than no suite.
        command: "bun run dev -- --port 8099 --strictPort",
        url: "http://127.0.0.1:8099",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
