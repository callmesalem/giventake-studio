import { describe, test, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Reveal } from "@/components/reveal";

/**
 * Every public page wraps its sections in <Reveal>. On 2026-10-13 a screenshot
 * service rendered the whole site as the root error boundary because its
 * browser had no IntersectionObserver: the component threw inside an effect,
 * and nothing above it caught it. jsdom has neither matchMedia nor
 * IntersectionObserver, so this is the same environment, and the assertion is
 * the one that matters: the content is on the page.
 */
describe("Reveal without modern browser APIs", () => {
  const w = window as unknown as Record<string, unknown>;
  const saved = { matchMedia: w.matchMedia, IntersectionObserver: w.IntersectionObserver };
  afterEach(() => {
    w.matchMedia = saved.matchMedia;
    w.IntersectionObserver = saved.IntersectionObserver;
  });

  test("renders its children visible when matchMedia and IntersectionObserver are missing", () => {
    delete w.matchMedia;
    delete w.IntersectionObserver;
    render(
      <Reveal>
        <p>Section body</p>
      </Reveal>,
    );
    const body = screen.getByText("Section body");
    expect(body).toBeTruthy();
    expect(body.parentElement?.className).toContain("reveal-visible");
  });
});
