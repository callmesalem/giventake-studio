import { describe, test, expect, vi } from "vitest";
import { Component, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";

/**
 * Cookie-banner blocklists (uBlock Origin annoyance filters, Brave, AdGuard,
 * and Firecrawl's renderer) block any URL containing "consent-banner". On
 * 2026-10-13 that turned every public page into the root error boundary for
 * those visitors: the lazy import rejected, and the rejection reached the
 * nearest error boundary, which is the whole page.
 */
vi.mock("@/components/consent-banner", () => {
  throw new TypeError("Failed to fetch dynamically imported module");
});

import { DeferredConsentBanner } from "@/components/deferred-consent-banner";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p>boundary tripped</p> : this.props.children;
  }
}

describe("DeferredConsentBanner when its chunk is blocked", () => {
  test("renders nothing instead of throwing to the page's error boundary", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Boundary>
        <p>Page body</p>
        <DeferredConsentBanner />
      </Boundary>,
    );
    // Let the idle/timeout mount fire and the rejected import settle.
    await new Promise((r) => setTimeout(r, 2500));
    expect(screen.queryByText("boundary tripped")).toBeNull();
    expect(screen.getByText("Page body")).toBeTruthy();
    error.mockRestore();
  });
});
