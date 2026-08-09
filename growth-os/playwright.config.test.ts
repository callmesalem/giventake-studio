import { describe, expect, it } from "vitest";
import config from "./playwright.config";

const localUrl = "http://127.0.0.1:3000";

describe("Playwright web server configuration", () => {
  it("starts Vite on the same fixed strict port used by the browser", () => {
    expect(config.use?.baseURL).toBe(localUrl);
    expect(config.webServer).toMatchObject({
      command: "bun run dev -- --port 3000 --strictPort",
      url: localUrl,
    });
  });
});
